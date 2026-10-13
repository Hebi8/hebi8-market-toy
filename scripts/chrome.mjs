// A headless Chrome driven over the DevTools protocol, for the screenshot
// run and the poster. Chrome is started here with a throwaway profile and
// stopped by its own PID; no other process is looked for or touched.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `task({ open, problems, browser })`. `open({ width, height, mobile, scale })`
 * gives a page with `goto`, `evaluate`, `until`, `click`, `press`, `shot` and `close`;
 * `browser(method, params)` sends a DevTools command to the browser itself.
 * `problems` collects page errors and requests to any host outside `origins`.
 */
export async function withChrome(origins, task) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "hebi8-toy-chrome-"));
  const chrome = spawn("google-chrome", [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu",
    "--allow-file-access-from-files", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const problems = [];
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let log = "";
      chrome.stderr.on("data", (chunk) => {
        log += chunk;
        const found = /DevTools listening on (ws:\/\/\S+)/.exec(log);
        if (found) resolve(found[1]);
      });
      chrome.on("exit", () => reject(new Error(`Chrome exited before it was ready:\n${log}`)));
      setTimeout(() => reject(new Error("Chrome did not start in 20 s")), 20_000);
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });

    let nextId = 1;
    const waiting = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const { resolve, reject } = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method === "Runtime.exceptionThrown") {
        problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      } else if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
        problems.push(`${message.params.entry.text} ${message.params.entry.url ?? ""}`);
      } else if (message.method === "Network.requestWillBeSent") {
        const { url } = message.params.request;
        if (!origins.some((origin) => url.startsWith(origin)) && !/^(data|about|blob):/.test(url)) problems.push(`request to another host: ${url}`);
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

    const open = async ({ width, height, mobile = false, scale = 2 }) => {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const cdp = (method, params) => send(method, params, sessionId);
      await Promise.all([cdp("Page.enable"), cdp("Runtime.enable"), cdp("Log.enable"), cdp("Network.enable")]);
      await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
      if (mobile) await cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
      const evaluate = async (expression) => {
        const answer = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text);
        return answer.result.value;
      };
      const until = async (expression, what, timeout = 15_000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (await evaluate(expression)) return;
          await sleep(100);
        }
        throw new Error(`timed out waiting for ${what}`);
      };
      return {
        evaluate,
        until,
        async goto(url) {
          await cdp("Page.navigate", { url });
          await until(`document.readyState === "complete"`, url);
        },
        click: (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),
        /** A click the browser counts as the user's own, for what only works on a user gesture. */
        async press(selector) {
          const { x, y } = await evaluate(`(() => {
            const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
            return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          })()`);
          for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
        },
        async shot(file) {
          await sleep(350);
          const { data } = await cdp("Page.captureScreenshot", { format: "png" });
          await writeFile(file, Buffer.from(data, "base64"));
        },
        close: () => send("Target.closeTarget", { targetId }),
      };
    };
    await task({ open, problems, browser: (method, params) => send(method, params) });
  } finally {
    socket?.close();
    chrome.kill();
    await new Promise((resolve) => (chrome.exitCode == null ? chrome.once("exit", resolve) : resolve()));
    await rm(profile, { recursive: true, force: true });
  }
  return problems;
}

export { sleep };
