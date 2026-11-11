use std::path::PathBuf;
use std::process::Command;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{
    DialogExt, FilePath, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};

use crate::state::TITLE;

pub fn info(app: &AppHandle, message: &str, detail: Option<&str>, kind: MessageDialogKind) {
    let mut text = message.to_owned();
    if let Some(d) = detail.filter(|d| !d.is_empty()) {
        text.push_str("\n\n");
        text.push_str(d);
    }
    let _ = app
        .dialog()
        .message(text)
        .title(TITLE)
        .kind(kind)
        .buttons(MessageDialogButtons::Ok)
        .blocking_show();
}

pub fn ask(app: &AppHandle, message: &str, detail: Option<&str>) -> bool {
    let mut text = message.to_owned();
    if let Some(d) = detail.filter(|d| !d.is_empty()) {
        text.push_str("\n\n");
        text.push_str(d);
    }
    matches!(
        app.dialog()
            .message(text)
            .title(TITLE)
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::OkCancel)
            .blocking_show_with_result(),
        MessageDialogResult::Ok
    )
}

pub enum LeaveChoice {
    Save,
    Discard,
    Cancel,
}

pub fn confirm_leave_dialog(app: &AppHandle, message: &str, detail: &str) -> LeaveChoice {
    let text = format!("{message}\n\n{detail}");
    match app
        .dialog()
        .message(text)
        .title(TITLE)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            "Simpan".into(),
            "Jangan Simpan".into(),
            "Batal".into(),
        ))
        .blocking_show_with_result()
    {
        MessageDialogResult::Custom(s) if s == "Simpan" => LeaveChoice::Save,
        MessageDialogResult::Custom(s) if s == "Jangan Simpan" => LeaveChoice::Discard,
        MessageDialogResult::Yes => LeaveChoice::Save,
        MessageDialogResult::No => LeaveChoice::Discard,
        _ => LeaveChoice::Cancel,
    }
}

pub fn pick_file(
    app: &AppHandle,
    title: &str,
    filters: &[(&str, &[&str])],
) -> Option<PathBuf> {
    let mut dlg = app.dialog().file().set_title(title);
    for (name, exts) in filters {
        dlg = dlg.add_filter(name.to_string(), exts);
    }
    dlg.blocking_pick_file().and_then(file_path)
}

pub fn pick_files(
    app: &AppHandle,
    title: &str,
    filters: &[(&str, &[&str])],
) -> Vec<PathBuf> {
    let mut dlg = app.dialog().file().set_title(title);
    for (name, exts) in filters {
        dlg = dlg.add_filter(name.to_string(), exts);
    }
    dlg.blocking_pick_files()
        .map(|list| list.into_iter().filter_map(file_path).collect())
        .unwrap_or_default()
}

pub fn save_file(
    app: &AppHandle,
    title: &str,
    default_path: Option<PathBuf>,
    filters: &[(&str, &[&str])],
) -> Option<PathBuf> {
    let mut dlg = app.dialog().file().set_title(title);
    for (name, exts) in filters {
        dlg = dlg.add_filter(name.to_string(), exts);
    }
    if let Some(path) = default_path {
        if let Some(parent) = path.parent() {
            if parent.is_dir() {
                dlg = dlg.set_directory(parent);
            }
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            dlg = dlg.set_file_name(name);
        }
    }
    dlg.blocking_save_file().and_then(file_path)
}

fn file_path(path: FilePath) -> Option<PathBuf> {
    path.into_path().ok()
}

pub fn documents_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .document_dir()
        .unwrap_or_else(|_| app.path().home_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

pub fn open_external(target: &str) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        return Command::new("cmd")
            .args(["/C", "start", "", target])
            .creation_flags(0x08000000)
            .spawn()
            .is_ok();
    }
    #[cfg(target_os = "macos")]
    {
        return Command::new("open").arg(target).spawn().is_ok();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return Command::new("xdg-open").arg(target).spawn().is_ok();
    }
    #[allow(unreachable_code)]
    false
}

pub fn open_folder(path: &std::path::Path) -> bool {
    open_external(&path.to_string_lossy())
}
