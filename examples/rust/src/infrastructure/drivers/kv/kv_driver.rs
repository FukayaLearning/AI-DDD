use std::fs;
use std::io;
use std::path::PathBuf;

pub trait KeyValueStorageDriver {
    fn put(&self, key: &str, payload: &str) -> io::Result<()>;
    fn get(&self, key: &str) -> io::Result<String>;
}

pub struct FileKvDriver {
    dir_path: PathBuf,
}

impl FileKvDriver {
    pub fn new(dir_path: impl Into<PathBuf>) -> Self {
        Self {
            dir_path: dir_path.into(),
        }
    }
}

impl KeyValueStorageDriver for FileKvDriver {
    fn put(&self, key: &str, payload: &str) -> io::Result<()> {
        fs::create_dir_all(&self.dir_path)?;
        fs::write(self.dir_path.join(format!("{}.json", key)), payload)
    }

    fn get(&self, key: &str) -> io::Result<String> {
        fs::read_to_string(self.dir_path.join(format!("{}.json", key)))
    }
}
