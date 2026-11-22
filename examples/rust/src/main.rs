use ordering_rs::application::order::commands::order_service::OrderApplicationService;
use ordering_rs::infrastructure::acl::inventory::inventory_gateway::InventoryGateway;
use ordering_rs::infrastructure::acl::payment::payment_gateway::PaymentGateway;
use ordering_rs::infrastructure::drivers::http::http_driver::TcpHttpJsonDriver;
use ordering_rs::infrastructure::drivers::kv::kv_driver::FileKvDriver;
use ordering_rs::infrastructure::persistence::order::driver_order_repository::DriverOrderRepository;
use ordering_rs::presentation::web::i18n::en::EN_MESSAGES;
use ordering_rs::presentation::web::i18n::ja::JA_MESSAGES;
use ordering_rs::presentation::web::order::order_web_server::serve_single_connection;
use std::net::TcpListener;

pub fn create_ordering_app(
    data_dir: &str,
    inventory_url: &str,
    payment_url: &str,
    http_timeout_ms: u64,
) -> OrderApplicationService<
    DriverOrderRepository<FileKvDriver>,
    InventoryGateway<TcpHttpJsonDriver>,
    PaymentGateway<TcpHttpJsonDriver>,
> {
    let kv = FileKvDriver::new(data_dir);
    let repo = DriverOrderRepository::new(kv);
    let inv = InventoryGateway::new(TcpHttpJsonDriver::new(http_timeout_ms), inventory_url);
    let pay = PaymentGateway::new(TcpHttpJsonDriver::new(http_timeout_ms), payment_url);
    OrderApplicationService::new(repo, inv, pay)
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let data_dir = std::env::var("ORDER_DATA_DIR").unwrap_or_else(|_| ".order-data".to_string());
    let inv_url = std::env::var("INVENTORY_URL").unwrap_or_else(|_| "http://127.0.0.1:4001/reserve".to_string());
    let pay_url = std::env::var("PAYMENT_URL").unwrap_or_else(|_| "http://127.0.0.1:4002/charge".to_string());
    let timeout_ms: u64 = std::env::var("HTTP_TIMEOUT_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(5000);
    let app_locale = std::env::var("APP_LOCALE").unwrap_or_else(|_| "ja".to_string());
    let messages = if app_locale == "en" { &EN_MESSAGES } else { &JA_MESSAGES };

    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).expect("bind failed");
    let addr = listener.local_addr().expect("addr failed");
    println!("LISTENING http://{}", addr);

    let uc = create_ordering_app(&data_dir, &inv_url, &pay_url, timeout_ms);
    for stream in listener.incoming().flatten() {
        serve_single_connection(stream, &uc, messages);
    }
}
