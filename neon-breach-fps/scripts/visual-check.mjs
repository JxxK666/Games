import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");
const outputRoot = join(projectRoot, "outputs");
const port = 5196;

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

const resolveRequestPath = (url) => {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const candidate = normalize(join(distRoot, pathname));
  if (!candidate.startsWith(distRoot)) return join(distRoot, "index.html");
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return join(distRoot, "index.html");
};

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");
  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

const listen = () =>
  new Promise((resolveListen) => {
    server.listen(port, "127.0.0.1", resolveListen);
  });

const close = () =>
  new Promise((resolveClose) => {
    server.close(resolveClose);
  });

const intersect = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const run = async () => {
  if (!existsSync(distRoot)) throw new Error("dist/ not found. Run npm run build first.");
  mkdirSync(outputRoot, { recursive: true });

  const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
  if (!executablePath) throw new Error("No Chrome or Edge executable found for visual QA.");

  await listen();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"],
  });

  const reports = [];
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`http://127.0.0.1:${port}/?autostart=1&qa=1`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1400);
      const screenshotPath = join(outputRoot, `neon-breach-${viewport.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const report = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
          return { ok: false, reason: "missing canvas" };
        }
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) {
          return { ok: false, reason: "missing webgl context" };
        }

        const samples = [];
        const positions = [
          [0.12, 0.18],
          [0.5, 0.5],
          [0.82, 0.22],
          [0.25, 0.72],
          [0.72, 0.78],
          [0.5, 0.18],
          [0.18, 0.5],
          [0.84, 0.52],
        ];
        const pixel = new Uint8Array(4);
        for (const [xRatio, yRatio] of positions) {
          const x = Math.max(0, Math.min(gl.drawingBufferWidth - 1, Math.floor(gl.drawingBufferWidth * xRatio)));
          const y = Math.max(0, Math.min(gl.drawingBufferHeight - 1, Math.floor(gl.drawingBufferHeight * yRatio)));
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          samples.push([pixel[0], pixel[1], pixel[2], pixel[3]]);
        }

        const uniqueColors = new Set(samples.map((sample) => sample.join(","))).size;
        const brightSamples = samples.filter(([r, g, b]) => r + g + b > 24).length;
        const crosshair = document.querySelector("#crosshair")?.getBoundingClientRect();
        const hudRects = [...document.querySelectorAll(".objective-chip, .status-strip, .combat-notice")]
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => ({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          }));
        const overlap = crosshair
          ? hudRects.some((rect) =>
              rect.left < crosshair.right &&
              rect.right > crosshair.left &&
              rect.top < crosshair.bottom &&
              rect.bottom > crosshair.top,
            )
          : true;

        return {
          ok: brightSamples >= 3 && uniqueColors >= 3 && !overlap,
          canvas: {
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            drawingBufferWidth: gl.drawingBufferWidth,
            drawingBufferHeight: gl.drawingBufferHeight,
          },
          brightSamples,
          uniqueColors,
          overlap,
          hudRects,
          crosshair: crosshair
            ? {
                left: crosshair.left,
                right: crosshair.right,
                top: crosshair.top,
                bottom: crosshair.bottom,
              }
            : null,
        };
      });

      reports.push({ viewport, screenshotPath, ...report });
      await page.close();
    }
  } finally {
    await browser.close();
    await close();
  }

  const failed = reports.filter((report) => !report.ok);
  writeFileSync(join(outputRoot, "visual-check-report.json"), JSON.stringify(reports, null, 2));
  if (failed.length > 0) {
    throw new Error(`Visual check failed: ${failed.map((item) => item.viewport.name).join(", ")}`);
  }

  console.log(JSON.stringify(reports, null, 2));
};

run().catch(async (error) => {
  try {
    await close();
  } catch {
    // ignore close failures after startup errors
  }
  console.error(error);
  process.exit(1);
});

export { intersect };
