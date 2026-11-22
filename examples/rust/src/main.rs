use ordering_rs::application::order_service::OrderApplicationService;
use ordering_rs::infrastructure::acl::external_gateways::{InventoryGateway, PaymentGateway};
use ordering_rs::infrastructure::drivers::http_driver::TcpHttpJsonDriver;
use ordering_rs::infrastructure::drivers::kv_driver::FileKvDriver;
use ordering_rs::infrastructure::repository::driver_order_repository::DriverOrderRepository;
use ordering_rs::presentation::order_web_server::serve_single_connection;
use std::net::TcpListener;

pub fn create_ordering_app(
    data_dir: &str,
    inventory_url: &str,
    payment_url: &str,
) -> OrderApplicationService<
    DriverOrderRepository<FileKvDriver>,
    InventoryGateway<TcpHttpJsonDriver>,
    PaymentGateway<TcpHttpJsonDriver>,
> {
    let kv = FileKvDriver::new(data_dir);
    let repo = DriverOrderRepository::new(kv);
    let inv = InventoryGateway::new(TcpHttpJsonDriver, inventory_url);
    let pay = PaymentGateway::new(TcpHttpJsonDriver, payment_url);
    OrderApplicationService::new(repo, inv, pay)
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let data_dir = std::env::var("ORDER_DATA_DIR").unwrap_or_else(|_| ".order-data".to_string());
    let inv_url = std::env::var("INVENTORY_URL").unwrap_or_else(|_| "http://127.0.0.1:4001/reserve".to_string());
    let pay_url = std::env::var("PAYMENT_URL").unwrap_or_else(|_| "http://127.0.0.1:4002/charge".to_string());

    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).expect("bind failed");
    let addr = listener.local_addr().expect("addr failed");
    println!("LISTENING http://{}", addr);

    let uc = create_ordering_app(&data_dir, &inv_url, &pay_url);
    for stream in listener.incoming().flatten() {
        serve_single_connection(stream, &uc);
    }
}
