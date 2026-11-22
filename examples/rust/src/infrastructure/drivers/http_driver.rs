use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

pub trait HttpJsonDriver {
    fn post_json_raw(&self, url: &str, body_json: &str) -> Result<String, String>;
}

pub struct TcpHttpJsonDriver;

impl HttpJsonDriver for TcpHttpJsonDriver {
    fn post_json_raw(&self, url: &str, body_json: &str) -> Result<String, String> {
        let stripped = url.strip_prefix("http://").unwrap_or(url);
        let (host_port, req_path_tail) = stripped.split_once('/').unwrap_or((stripped, ""));
        let req_path = format!("/{}", req_path_tail);
        let mut stream = TcpStream::connect(host_port).map_err(|e| e.to_string())?;
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let req = format!(
            "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            req_path,
            host_port,
            body_json.len(),
            body_json
        );
        stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
        let mut resp = String::new();
        stream.read_to_string(&mut resp).map_err(|e| e.to_string())?;
        Ok(resp)
    }
}
