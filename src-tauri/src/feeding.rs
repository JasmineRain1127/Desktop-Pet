use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedingResult {
    file_name: String,
    extension: String,
    size_bytes: u64,
    modified_at: u64,
    flavor: FeedingFlavor,
    reaction_mood: &'static str,
    message: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum FeedingFlavor {
    Code,
    Image,
    Archive,
    Large,
    Unknown,
}

#[tauri::command]
pub fn feed_file_path(path: String) -> Result<FeedingResult, String> {
    let path = Path::new(&path);
    let metadata = fs::metadata(path).map_err(|error| format!("无法读取文件信息：{error}"))?;

    if !metadata.is_file() {
        return Ok(FeedingResult {
            file_name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("未命名项目")
                .to_string(),
            extension: String::new(),
            size_bytes: 0,
            modified_at: modified_at_millis(&metadata),
            flavor: FeedingFlavor::Unknown,
            reaction_mood: "sad",
            message: "这个不像能吃的文件",
        });
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("未命名文件")
        .to_string();
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_lowercase();
    let size_bytes = metadata.len();

    Ok(classify_feeding_result(
        file_name,
        extension,
        size_bytes,
        modified_at_millis(&metadata),
    ))
}

fn classify_feeding_result(
    file_name: String,
    extension: String,
    size_bytes: u64,
    modified_at: u64,
) -> FeedingResult {
    let (flavor, reaction_mood, message) = if size_bytes >= 50 * 1024 * 1024 {
        (FeedingFlavor::Large, "sad", "这口太大了")
    } else if archive_extensions().contains(&extension.as_str()) {
        (FeedingFlavor::Archive, "sad", "压缩包有点硌牙")
    } else if code_extensions().contains(&extension.as_str()) {
        (FeedingFlavor::Code, "happy", "代码味道不错")
    } else if image_extensions().contains(&extension.as_str()) {
        (FeedingFlavor::Image, "happy", "图像脆脆的")
    } else {
        (FeedingFlavor::Unknown, "sad", "还没学会吃这个")
    };

    FeedingResult {
        file_name,
        extension,
        size_bytes,
        modified_at,
        flavor,
        reaction_mood,
        message,
    }
}

fn modified_at_millis(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn code_extensions() -> &'static [&'static str] {
    &[
        "c", "cpp", "cs", "css", "go", "html", "java", "js", "json", "jsx", "md", "py", "rs",
        "swift", "toml", "ts", "tsx", "vue", "yaml", "yml",
    ]
}

fn image_extensions() -> &'static [&'static str] {
    &["gif", "jpeg", "jpg", "png", "svg", "webp"]
}

fn archive_extensions() -> &'static [&'static str] {
    &["7z", "dmg", "gz", "rar", "tar", "tgz", "zip"]
}
