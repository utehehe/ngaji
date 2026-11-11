use std::time::Duration;

use serde_json::{json, Value};
use tauri::WebviewWindow;

#[cfg(windows)]
pub fn cdp_call(win: &WebviewWindow, method: &str, params: &str) -> Result<String, String> {
    use std::sync::mpsc;
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows::core::HSTRING;

    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let method = method.to_owned();
    let params = params.to_owned();
    let started = win.with_webview(move |platform| {
        let controller = platform.controller();
        let core = match unsafe { controller.CoreWebView2() } {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(Err(format!("WebView2 tidak siap: {e}")));
                return;
            }
        };
        let method_h = HSTRING::from(method.as_str());
        let params_h = HSTRING::from(params.as_str());
        let sender = tx.clone();
        let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
            move |result, json_text: String| {
                let value = match result {
                    Ok(()) => Ok(json_text),
                    Err(e) => Err(format!("CDP {e}")),
                };
                let _ = sender.send(value);
                Ok(())
            },
        ));
        if let Err(e) = unsafe {
            core.CallDevToolsProtocolMethod(&method_h, &params_h, &handler)
        } {
            let _ = tx.send(Err(format!("CDP gagal: {e}")));
        }
    });
    if let Err(e) = started {
        return Err(format!("Tidak dapat menghubungi WebView2: {e}"));
    }
    match rx.recv_timeout(Duration::from_secs(180)) {
        Ok(result) => result,
        Err(_) => Err("Waktu habis menunggu WebView2.".to_owned()),
    }
}

#[cfg(not(windows))]
pub fn cdp_call(_win: &WebviewWindow, _method: &str, _params: &str) -> Result<String, String> {
    Err("Fitur ini memerlukan Windows (WebView2).".to_owned())
}

/// Evaluate JavaScript and return the CDP Runtime.evaluate result object.
pub fn eval_js(win: &WebviewWindow, expression: &str, await_promise: bool) -> Result<Value, String> {
    #[cfg(windows)]
    {
        let params = json!({
            "expression": expression,
            "returnByValue": true,
            "awaitPromise": await_promise,
        })
        .to_string();
        let raw = cdp_call(win, "Runtime.evaluate", &params)?;
        let value: Value =
            serde_json::from_str(&raw).map_err(|e| format!("Jawaban CDP tidak valid: {e}"))?;
        if let Some(exc) = value.get("exceptionDetails") {
            let text = exc
                .get("exception")
                .and_then(|e| e.get("description"))
                .or_else(|| exc.get("text"))
                .and_then(Value::as_str)
                .unwrap_or("Kesalahan JavaScript");
            return Err(text.to_owned());
        }
        Ok(value.get("result").cloned().unwrap_or(Value::Null))
    }
    #[cfg(not(windows))]
    {
        let _ = await_promise;
        win.eval(expression).map_err(|e| e.to_string())?;
        std::thread::sleep(Duration::from_millis(350));
        Ok(Value::Null)
    }
}
