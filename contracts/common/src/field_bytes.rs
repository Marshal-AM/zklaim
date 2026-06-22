use soroban_sdk::{Bytes, BytesN, Env, Vec};

pub const FIELD_BYTES: u32 = 32;

pub fn field_to_bytes(env: &Env, value: &BytesN<32>) -> Bytes {
    let mut out = Bytes::new(env);
    out.extend_from_array(&value.to_array());
    out
}

pub fn pack_fields(env: &Env, fields: &Vec<BytesN<32>>) -> Bytes {
    let mut out = Bytes::new(env);
    for field in fields.iter() {
        out.extend_from_array(&field.to_array());
    }
    out
}

pub fn bytes_to_field(bytes: &BytesN<32>) -> BytesN<32> {
    bytes.clone()
}

pub fn zero_field(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}
