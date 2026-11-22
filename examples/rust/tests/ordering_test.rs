use ordering_rs::application::order_service::{
    OrderApplicationService, OrderLineDto, OrderSummaryDto, OrderUseCases, PlaceOrderCommand,
    PlaceOrderLineInput,
};
use ordering_rs::domain::errors::DomainError;
use ordering_rs::domain::order::{Order, OrderLine, OrderStatus};
use ordering_rs::domain::ports::{InventoryPort, OrderRepository, PaymentPort};
use ordering_rs::domain::result::DomainResult;
use ordering_rs::domain::value_objects::{
    add_money, create_customer_id, create_money, create_order_id, create_product_id,
    create_quantity, multiply_money, Currency, Money, OrderId,
};
use ordering_rs::infrastructure::acl::external_gateways::{
    extract_http_status, InventoryGateway, PaymentGateway,
};
use ordering_rs::infrastructure::drivers::http_driver::HttpJsonDriver;
use ordering_rs::infrastructure::drivers::kv_driver::KeyValueStorageDriver;
use ordering_rs::infrastructure::repository::driver_order_repository::DriverOrderRepository;
use ordering_rs::infrastructure::repository::order_mapper::{decode_order_record, encode_order_record};
use ordering_rs::presentation::order_web_server::serve_single_connection;
use std::collections::HashMap;
use std::io::{self, ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Clone)]
struct InMemoryRepo {
    data: Arc<Mutex<HashMap<String, Order>>>,
    fail_save: Arc<Mutex<bool>>,
}

impl InMemoryRepo {
    fn new() -> Self {
        Self {
            data: Arc::new(Mutex::new(HashMap::new())),
            fail_save: Arc::new(Mutex::new(false)),
        }
    }
}

impl OrderRepository for InMemoryRepo {
    fn save(&self, order: &Order) -> DomainResult<(), DomainError> {
        if *self.fail_save.lock().unwrap() {
            return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "db down"));
        }
        self.data.lock().unwrap().insert(order.id.0.clone(), order.clone());
        DomainResult::Ok(())
    }

    fn find_by_id(&self, order_id: &OrderId) -> DomainResult<Order, DomainError> {
        match self.data.lock().unwrap().get(&order_id.0) {
            Some(o) => DomainResult::Ok(o.clone()),
            None => DomainResult::Err(DomainError::new("ORDER_NOT_FOUND", "missing")),
        }
    }
}

struct StubInv(Option<DomainError>);
impl InventoryPort for StubInv {
    fn reserve_stock(&self, _: &OrderId, _: &[OrderLine]) -> DomainResult<(), DomainError> {
        match &self.0 {
            Some(e) => DomainResult::Err(e.clone()),
            None => DomainResult::Ok(()),
        }
    }
}

struct StubPay(Option<DomainError>);
impl PaymentPort for StubPay {
    fn charge(&self, _: &OrderId, _: Money) -> DomainResult<(), DomainError> {
        match &self.0 {
            Some(e) => DomainResult::Err(e.clone()),
            None => DomainResult::Ok(()),
        }
    }
}

struct MockKv {
    data: Mutex<HashMap<String, String>>,
    put_err: Mutex<bool>,
    get_err: Mutex<bool>,
}

impl KeyValueStorageDriver for MockKv {
    fn put(&self, key: &str, payload: &str) -> io::Result<()> {
        if *self.put_err.lock().unwrap() {
            return Err(io::Error::new(ErrorKind::Other, "disk full"));
        }
        self.data.lock().unwrap().insert(key.to_string(), payload.to_string());
        Ok(())
    }

    fn get(&self, key: &str) -> io::Result<String> {
        if *self.get_err.lock().unwrap() {
            return Err(io::Error::new(ErrorKind::Other, "disk io"));
        }
        self.data
            .lock()
            .unwrap()
            .get(key)
            .cloned()
            .ok_or_else(|| io::Error::new(ErrorKind::NotFound, "missing"))
    }
}

struct MockHttp {
    response: Result<String, String>,
}

impl HttpJsonDriver for MockHttp {
    fn post_json_raw(&self, _: &str, _: &str) -> Result<String, String> {
        self.response.clone()
    }
}

struct MockWebUseCases {
    place_res: Arc<Mutex<DomainResult<OrderSummaryDto, DomainError>>>,
    confirm_res: Arc<Mutex<DomainResult<OrderSummaryDto, DomainError>>>,
    cancel_res: Arc<Mutex<DomainResult<OrderSummaryDto, DomainError>>>,
    get_res: Arc<Mutex<DomainResult<OrderSummaryDto, DomainError>>>,
}

impl OrderUseCases for MockWebUseCases {
    fn place_order(&self, _: PlaceOrderCommand) -> DomainResult<OrderSummaryDto, DomainError> {
        self.place_res.lock().unwrap().clone()
    }
    fn confirm_order(&self, _: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        self.confirm_res.lock().unwrap().clone()
    }
    fn cancel_order(&self, _: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        self.cancel_res.lock().unwrap().clone()
    }
    fn get_order(&self, _: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        self.get_res.lock().unwrap().clone()
    }
}

fn unwrap_ok<T: std::fmt::Debug, E: std::fmt::Debug>(res: DomainResult<T, E>) -> T {
    match res {
        DomainResult::Ok(v) => v,
        DomainResult::Err(e) => panic!("expected Ok, got {:?}", e),
    }
}

fn unwrap_err<T: std::fmt::Debug, E: std::fmt::Debug>(res: DomainResult<T, E>) -> E {
    match res {
        DomainResult::Ok(v) => panic!("expected Err, got {:?}", v),
        DomainResult::Err(e) => e,
    }
}

#[test]
fn domain_all_branches() {
    assert_eq!(unwrap_err(create_order_id(" ")).code, "INVALID_ORDER_ID");
    let oid = unwrap_ok(create_order_id(" ORD-1 "));
    assert_eq!(unwrap_err(create_customer_id(" ")).code, "INVALID_CUSTOMER_ID");
    let cid = unwrap_ok(create_customer_id(" CUST-1 "));
    assert_eq!(unwrap_err(create_product_id(" ")).code, "INVALID_PRODUCT_ID");
    let p1 = unwrap_ok(create_product_id(" P1 "));
    let p2 = unwrap_ok(create_product_id(" P2 "));

    assert_eq!(unwrap_err(create_quantity(0)).code, "INVALID_QUANTITY");
    assert_eq!(unwrap_err(create_quantity(101)).code, "INVALID_QUANTITY");
    let q2 = unwrap_ok(create_quantity(2));

    assert_eq!(unwrap_err(create_money(-1, Currency::JPY)).code, "INVALID_MONEY_AMOUNT");
    assert_eq!(unwrap_err(Currency::from_str("EUR")).code, "CURRENCY_MISMATCH");
    let jpy = unwrap_ok(create_money(500, Currency::JPY));
    let usd = unwrap_ok(create_money(5, Currency::USD));
    let sub = multiply_money(jpy, q2);
    assert_eq!(sub.amount, 1000);
    assert_eq!(unwrap_err(add_money(jpy, usd)).code, "CURRENCY_MISMATCH");
    assert_eq!(unwrap_ok(add_money(jpy, sub)).amount, 1500);

    assert_eq!(unwrap_err(Order::create(oid.clone(), cid.clone(), vec![], OrderStatus::Draft, vec![])).code, "EMPTY_ORDER_LINES");
    let six = (0..6)
        .map(|i| OrderLine {
            product_id: unwrap_ok(create_product_id(&format!("P{}", i))),
            quantity: q2,
            unit_price: jpy,
        })
        .collect();
    assert_eq!(unwrap_err(Order::create(oid.clone(), cid.clone(), six, OrderStatus::Draft, vec![])).code, "TOO_MANY_ORDER_LINES");

    assert_eq!(
        unwrap_err(Order::create(
            oid.clone(),
            cid.clone(),
            vec![
                OrderLine { product_id: p1.clone(), quantity: q2, unit_price: jpy },
                OrderLine { product_id: p1.clone(), quantity: q2, unit_price: jpy },
            ],
            OrderStatus::Draft,
            vec![]
        )).code,
        "DUPLICATE_PRODUCT"
    );
    assert_eq!(
        unwrap_err(Order::create(
            oid.clone(),
            cid.clone(),
            vec![
                OrderLine { product_id: p1.clone(), quantity: q2, unit_price: jpy },
                OrderLine { product_id: p2, quantity: q2, unit_price: usd },
            ],
            OrderStatus::Draft,
            vec![]
        )).code,
        "CURRENCY_MISMATCH"
    );

    let order = unwrap_ok(Order::create(
        oid,
        cid,
        vec![OrderLine { product_id: p1, quantity: q2, unit_price: jpy }],
        OrderStatus::Draft,
        vec![],
    ));
    assert_eq!(order.total_amount().amount, 1000);
    let conf = unwrap_ok(order.confirm());
    assert_eq!(conf.status, OrderStatus::Confirmed);
    assert_eq!(unwrap_err(conf.confirm()).code, "INVALID_ORDER_STATE");
    let canc = unwrap_ok(conf.cancel());
    assert_eq!(canc.status, OrderStatus::Cancelled);
    assert_eq!(unwrap_err(canc.cancel()).code, "INVALID_ORDER_STATE");
}

#[test]
fn infrastructure_all_branches() {
    let oid = unwrap_ok(create_order_id("ORD-100"));
    let cid = unwrap_ok(create_customer_id("CUST-1"));
    let pid = unwrap_ok(create_product_id("P1"));
    let qty = unwrap_ok(create_quantity(3));
    let price = unwrap_ok(create_money(200, Currency::JPY));
    let order = unwrap_ok(Order::create(oid.clone(), cid, vec![OrderLine { product_id: pid, quantity: qty, unit_price: price }], OrderStatus::Draft, vec![]));
    let cancelled = unwrap_ok(unwrap_ok(order.confirm()).cancel());

    let encoded = encode_order_record(&cancelled);
    assert!(matches!(decode_order_record(&encoded), DomainResult::Ok(_)));
    assert_eq!(unwrap_err(decode_order_record("customerId=c\nstatus=Draft\nlines=")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\nstatus=Draft\nlines=")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nlines=")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=\ncustomerId=c\nstatus=Draft\nlines=P1:1:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=\nstatus=Draft\nlines=P1:1:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Bad\nlines=P1:1:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=bad")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=:1:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=P1:x:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=P1:0:10:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=P1:1:x:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=P1:1:10:EUR")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=P1:1:-1:JPY")).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(decode_order_record("id=1\ncustomerId=c\nstatus=Draft\nlines=")).code, "REPOSITORY_ERROR");

    let kv = MockKv {
        data: Mutex::new(HashMap::new()),
        put_err: Mutex::new(false),
        get_err: Mutex::new(false),
    };
    let repo = DriverOrderRepository::new(kv);
    assert!(matches!(repo.save(&order), DomainResult::Ok(())));
    assert!(matches!(repo.find_by_id(&oid), DomainResult::Ok(_)));
    assert_eq!(unwrap_err(repo.find_by_id(&unwrap_ok(create_order_id("MISS")))).code, "ORDER_NOT_FOUND");

    let kv_err = MockKv {
        data: Mutex::new(HashMap::new()),
        put_err: Mutex::new(true),
        get_err: Mutex::new(true),
    };
    let repo_err = DriverOrderRepository::new(kv_err);
    assert_eq!(unwrap_err(repo_err.save(&order)).code, "REPOSITORY_ERROR");
    assert_eq!(unwrap_err(repo_err.find_by_id(&oid)).code, "REPOSITORY_ERROR");

    assert_eq!(extract_http_status("HTTP/1.1 200 OK\r\n\r\n"), 200);
    assert_eq!(extract_http_status("bad"), 500);
    assert!(matches!(InventoryGateway::new(MockHttp { response: Ok("HTTP/1.1 200 OK".into()) }, "http://inv").reserve_stock(&oid, &order.lines), DomainResult::Ok(())));
    assert_eq!(unwrap_err(InventoryGateway::new(MockHttp { response: Ok("HTTP/1.1 409 Conflict".into()) }, "http://inv").reserve_stock(&oid, &order.lines)).code, "INSUFFICIENT_STOCK");
    assert_eq!(unwrap_err(InventoryGateway::new(MockHttp { response: Ok("HTTP/1.1 500 Err".into()) }, "http://inv").reserve_stock(&oid, &order.lines)).code, "EXTERNAL_TIMEOUT");
    assert_eq!(unwrap_err(InventoryGateway::new(MockHttp { response: Err("timeout".into()) }, "http://inv").reserve_stock(&oid, &order.lines)).code, "EXTERNAL_TIMEOUT");

    assert!(matches!(PaymentGateway::new(MockHttp { response: Ok("HTTP/1.1 200 OK".into()) }, "http://pay").charge(&oid, order.total_amount()), DomainResult::Ok(())));
    assert_eq!(unwrap_err(PaymentGateway::new(MockHttp { response: Ok("HTTP/1.1 402 Payment Required".into()) }, "http://pay").charge(&oid, order.total_amount())).code, "PAYMENT_DECLINED");
    assert_eq!(unwrap_err(PaymentGateway::new(MockHttp { response: Ok("HTTP/1.1 503 Unavailable".into()) }, "http://pay").charge(&oid, order.total_amount())).code, "EXTERNAL_TIMEOUT");
    assert_eq!(unwrap_err(PaymentGateway::new(MockHttp { response: Err("timeout".into()) }, "http://pay").charge(&oid, order.total_amount())).code, "EXTERNAL_TIMEOUT");
}

#[test]
fn application_scenarios() {
    let repo = InMemoryRepo::new();
    let svc = OrderApplicationService::new(repo.clone(), StubInv(None), StubPay(None));

    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "".into(), customer_id: "C1".into(), lines: vec![] })).code, "INVALID_ORDER_ID");
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "O1".into(), customer_id: "".into(), lines: vec![] })).code, "INVALID_CUSTOMER_ID");
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "O1".into(), customer_id: "C1".into(), lines: vec![PlaceOrderLineInput { product_id: "".into(), quantity: 1, unit_amount: 10, currency: Currency::JPY }] })).code, "INVALID_PRODUCT_ID");
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "O1".into(), customer_id: "C1".into(), lines: vec![PlaceOrderLineInput { product_id: "P1".into(), quantity: 0, unit_amount: 10, currency: Currency::JPY }] })).code, "INVALID_QUANTITY");
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "O1".into(), customer_id: "C1".into(), lines: vec![PlaceOrderLineInput { product_id: "P1".into(), quantity: 1, unit_amount: -1, currency: Currency::JPY }] })).code, "INVALID_MONEY_AMOUNT");
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "O1".into(), customer_id: "C1".into(), lines: vec![] })).code, "EMPTY_ORDER_LINES");

    *repo.fail_save.lock().unwrap() = true;
    assert_eq!(unwrap_err(svc.place_order(PlaceOrderCommand { order_id: "ORD-1".into(), customer_id: "C1".into(), lines: vec![PlaceOrderLineInput { product_id: "P1".into(), quantity: 1, unit_amount: 100, currency: Currency::JPY }] })).code, "REPOSITORY_ERROR");
    *repo.fail_save.lock().unwrap() = false;

    assert!(matches!(svc.place_order(PlaceOrderCommand { order_id: "ORD-1".into(), customer_id: "C1".into(), lines: vec![PlaceOrderLineInput { product_id: "P1".into(), quantity: 2, unit_amount: 500, currency: Currency::JPY }] }), DomainResult::Ok(_)));
    assert_eq!(unwrap_err(svc.get_order("")).code, "INVALID_ORDER_ID");
    assert_eq!(unwrap_err(svc.get_order("MISS")).code, "ORDER_NOT_FOUND");
    assert_eq!(unwrap_ok(svc.get_order("ORD-1")).order_id, "ORD-1");

    assert_eq!(unwrap_err(svc.confirm_order("")).code, "INVALID_ORDER_ID");
    assert_eq!(unwrap_err(svc.confirm_order("MISS")).code, "ORDER_NOT_FOUND");
    assert_eq!(unwrap_err(OrderApplicationService::new(repo.clone(), StubInv(Some(DomainError::new("INSUFFICIENT_STOCK", "s"))), StubPay(None)).confirm_order("ORD-1")).code, "INSUFFICIENT_STOCK");
    assert_eq!(unwrap_err(OrderApplicationService::new(repo.clone(), StubInv(None), StubPay(Some(DomainError::new("PAYMENT_DECLINED", "d")))).confirm_order("ORD-1")).code, "PAYMENT_DECLINED");

    *repo.fail_save.lock().unwrap() = true;
    assert_eq!(unwrap_err(svc.confirm_order("ORD-1")).code, "REPOSITORY_ERROR");
    *repo.fail_save.lock().unwrap() = false;

    assert_eq!(unwrap_ok(svc.confirm_order("ORD-1")).status, OrderStatus::Confirmed);
    assert_eq!(unwrap_err(svc.confirm_order("ORD-1")).code, "INVALID_ORDER_STATE");

    assert_eq!(unwrap_err(svc.cancel_order("")).code, "INVALID_ORDER_ID");
    assert_eq!(unwrap_err(svc.cancel_order("MISS")).code, "ORDER_NOT_FOUND");
    *repo.fail_save.lock().unwrap() = true;
    assert_eq!(unwrap_err(svc.cancel_order("ORD-1")).code, "REPOSITORY_ERROR");
    *repo.fail_save.lock().unwrap() = false;
    assert_eq!(unwrap_ok(svc.cancel_order("ORD-1")).status, OrderStatus::Cancelled);
    assert_eq!(unwrap_err(svc.cancel_order("ORD-1")).code, "INVALID_ORDER_STATE");
}

fn send_raw_http(addr: std::net::SocketAddr, req: &str) -> String {
    let mut s = TcpStream::connect(addr).unwrap();
    s.write_all(req.as_bytes()).unwrap();
    let mut out = String::new();
    s.read_to_string(&mut out).unwrap();
    out
}

#[test]
fn presentation_browser_all_branches() {
    let draft = OrderSummaryDto {
        order_id: "ORD-WEB-1".into(),
        customer_id: "CUST-9".into(),
        status: OrderStatus::Draft,
        total: Money { amount: 2400, currency: Currency::JPY },
        lines: vec![OrderLineDto { product_id: "BOOK-A".into(), quantity: 2, unit_price: Money { amount: 1200, currency: Currency::JPY } }],
    };
    let mut confirmed = draft.clone();
    confirmed.status = OrderStatus::Confirmed;
    let mut cancelled = draft.clone();
    cancelled.status = OrderStatus::Cancelled;

    let place_res = Arc::new(Mutex::new(DomainResult::Err(DomainError::new("EMPTY_ORDER_LINES", "invalid lines"))));
    let confirm_res = Arc::new(Mutex::new(DomainResult::Ok(confirmed.clone())));
    let cancel_res = Arc::new(Mutex::new(DomainResult::Ok(cancelled.clone())));
    let get_res = Arc::new(Mutex::new(DomainResult::Ok(draft.clone())));

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let stop = Arc::new(AtomicBool::new(false));
    let stop_srv = stop.clone();
    let uc = MockWebUseCases {
        place_res: place_res.clone(),
        confirm_res: confirm_res.clone(),
        cancel_res: cancel_res.clone(),
        get_res: get_res.clone(),
    };

    let handle = thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            if stop_srv.load(Ordering::SeqCst) {
                break;
            }
            serve_single_connection(stream, &uc);
        }
    });

    let base = format!("http://{}", addr);

    let run_browser = |json_actions: String| {
        let out = Command::new("node").args(["scripts/browser_driver.mjs", &json_actions]).output().unwrap();
        assert!(out.status.success(), "stdout: {}\nstderr: {}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    };

    // 1. Place invalid order -> 422 error banner
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/"}},{{"type":"fill","selector":"input[name='orderId']","value":"ORD-WEB-1"}},{{"type":"fill","selector":"input[name='customerId']","value":"CUST-9"}},{{"type":"fill","selector":"input[name='productId']","value":"BOOK-A"}},{{"type":"fill","selector":"select[name='currency']","value":"USD"}},{{"type":"click","selector":"[data-testid='place-order-btn']"}},{{"type":"assertText","selector":"[data-testid='error-banner']","expected":"EMPTY_ORDER_LINES: invalid lines"}}]"#,
        base
    ));

    // 2. Place valid order -> Draft view
    *place_res.lock().unwrap() = DomainResult::Ok(draft.clone());
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/"}},{{"type":"fill","selector":"input[name='orderId']","value":"ORD-WEB-1"}},{{"type":"fill","selector":"input[name='customerId']","value":"CUST-9"}},{{"type":"fill","selector":"input[name='productId']","value":"BOOK-A"}},{{"type":"click","selector":"[data-testid='place-order-btn']"}},{{"type":"assertText","selector":"[data-testid='order-status']","expected":"Draft"}}]"#,
        base
    ));

    // 3. Confirm error & Confirm success
    *confirm_res.lock().unwrap() = DomainResult::Err(DomainError::new("INSUFFICIENT_STOCK", "out of stock"));
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/orders/ORD-WEB-1"}},{{"type":"click","selector":"[data-testid='confirm-btn']"}},{{"type":"assertText","selector":"[data-testid='error-banner']","expected":"INSUFFICIENT_STOCK: out of stock"}}]"#,
        base
    ));

    *confirm_res.lock().unwrap() = DomainResult::Ok(confirmed.clone());
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/orders/ORD-WEB-1"}},{{"type":"click","selector":"[data-testid='confirm-btn']"}},{{"type":"assertText","selector":"[data-testid='order-status']","expected":"Confirmed"}},{{"type":"assertDisabled","selector":"[data-testid='confirm-btn']","expected":true}}]"#,
        base
    ));

    // 4. Cancel error & Cancel success
    *get_res.lock().unwrap() = DomainResult::Ok(confirmed);
    *cancel_res.lock().unwrap() = DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "db busy"));
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/orders/ORD-WEB-1"}},{{"type":"click","selector":"[data-testid='cancel-btn']"}},{{"type":"assertText","selector":"[data-testid='error-banner']","expected":"REPOSITORY_ERROR: db busy"}}]"#,
        base
    ));

    *cancel_res.lock().unwrap() = DomainResult::Ok(cancelled);
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/orders/ORD-WEB-1"}},{{"type":"click","selector":"[data-testid='cancel-btn']"}},{{"type":"assertText","selector":"[data-testid='order-status']","expected":"Cancelled"}},{{"type":"assertDisabled","selector":"[data-testid='cancel-btn']","expected":true}}]"#,
        base
    ));

    // 5. Missing order GET/POST/404 paths
    *get_res.lock().unwrap() = DomainResult::Err(DomainError::new("ORDER_NOT_FOUND", "missing"));
    run_browser(format!(
        r#"[{{"type":"goto","url":"{}/orders/UNKNOWN"}},{{"type":"assertText","selector":"[data-testid='error-banner']","expected":"ORDER_NOT_FOUND: missing"}},{{"type":"goto","url":"{}/not-exist"}},{{"type":"assertText","selector":"[data-testid='not-found']","expected":"Page Not Found"}}]"#,
        base, base
    ));

    *confirm_res.lock().unwrap() = DomainResult::Err(DomainError::new("ORDER_NOT_FOUND", "missing"));
    assert!(send_raw_http(addr, "POST /orders/UNKNOWN/confirm HTTP/1.1\r\nContent-Length: 0\r\n\r\n").starts_with("HTTP/1.1 404"));
    *cancel_res.lock().unwrap() = DomainResult::Err(DomainError::new("ORDER_NOT_FOUND", "missing"));
    assert!(send_raw_http(addr, "POST /orders/UNKNOWN/cancel HTTP/1.1\r\nContent-Length: 0\r\n\r\n").starts_with("HTTP/1.1 404"));
    assert!(send_raw_http(addr, "PUT / HTTP/1.1\r\nContent-Length: 0\r\n\r\n").starts_with("HTTP/1.1 404"));

    stop.store(true, Ordering::SeqCst);
    let _ = TcpStream::connect(addr);
    handle.join().unwrap();
}
