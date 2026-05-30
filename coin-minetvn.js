// ==UserScript==
// @name         Minet Auto Continue + Auto Bypass
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Auto open Minet earn/linkvertise, click Continue, redirect bypass, click Start Bypass
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const MINET_TARGET = "https://dashboard.minet.vn/earn/linkvertise";
    const MINET_EARN   = "https://dashboard.minet.vn/earn";

    const FIXED_BYPASS =
        "https://bypass.tools/vi/bypass?url=https%3A%2F%2Flinkvertise.com%2F380094%2Fygg9q9CsHDLy%3Fo%3Dsharing";

    let openedMinet      = false;
    let clickedContinue  = false;
    let bypassClicked    = false;
    let restartScheduled = false;

    // ==========================
    // SLEEP
    // ==========================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==========================
    // UI OVERLAY
    // ==========================
    let overlayEl = null;
    let cdInterval = null;

    function createOverlay() {
        if (overlayEl) return;

        overlayEl = document.createElement("div");
        overlayEl.id = "__minet_overlay__";
        overlayEl.innerHTML = `
            <style>
                #__minet_overlay__ {
                    position: fixed;
                    bottom: 18px;
                    right: 18px;
                    z-index: 2147483647;
                    background: rgba(20,20,20,0.92);
                    color: #eee;
                    font-family: monospace;
                    font-size: 12px;
                    border-radius: 10px;
                    padding: 10px 14px;
                    min-width: 220px;
                    max-width: 300px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
                    user-select: none;
                    pointer-events: none;
                    transition: opacity 0.3s;
                }
                #__minet_overlay__ .m-title {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 7px;
                    font-size: 11px;
                    color: #aaa;
                }
                #__minet_overlay__ .m-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #4caf50;
                    display: inline-block;
                    flex-shrink: 0;
                }
                #__minet_overlay__ .m-step {
                    font-size: 13px;
                    color: #fff;
                    font-weight: bold;
                    margin-bottom: 7px;
                    line-height: 1.4;
                }
                #__minet_overlay__ .m-bar-wrap {
                    background: #333;
                    border-radius: 4px;
                    height: 4px;
                    overflow: hidden;
                    margin-bottom: 6px;
                }
                #__minet_overlay__ .m-bar {
                    height: 100%;
                    border-radius: 4px;
                    background: #4caf50;
                    transition: width 0.4s, background 0.3s;
                }
                #__minet_overlay__ .m-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: #888;
                }
                #__minet_overlay__ .m-cd {
                    font-size: 13px;
                    font-weight: bold;
                    color: #ffb74d;
                }
            </style>
            <div class="m-title">
                <span class="m-dot" id="m_dot"></span>
                Minet Auto v2.3
            </div>
            <div class="m-step" id="m_step">Đang khởi động...</div>
            <div class="m-bar-wrap">
                <div class="m-bar" id="m_bar" style="width:0%"></div>
            </div>
            <div class="m-footer">
                <span class="m-cd" id="m_cd"></span>
                <span id="m_sub"></span>
            </div>
        `;

        const inject = () => {
            if (document.body) {
                document.body.appendChild(overlayEl);
            } else {
                document.addEventListener("DOMContentLoaded", () => {
                    document.body.appendChild(overlayEl);
                });
            }
        };
        inject();
    }

    function setStatus(step, { color = "#4caf50", progress = 0, sub = "", countdown = 0 } = {}) {
        createOverlay();

        const dot  = document.getElementById("m_dot");
        const txt  = document.getElementById("m_step");
        const bar  = document.getElementById("m_bar");
        const cd   = document.getElementById("m_cd");
        const subEl= document.getElementById("m_sub");

        if (dot)  dot.style.background  = color;
        if (txt)  txt.textContent       = step;
        if (bar)  { bar.style.width = progress + "%"; bar.style.background = color; }
        if (subEl) subEl.textContent    = sub;

        // đếm ngược
        if (cdInterval) clearInterval(cdInterval);
        if (cd) cd.textContent = "";

        if (countdown > 0 && cd) {
            let remain = countdown;
            cd.textContent = remain + "s";
            cdInterval = setInterval(() => {
                remain--;
                if (remain <= 0) {
                    clearInterval(cdInterval);
                    cd.textContent = "";
                } else {
                    cd.textContent = remain + "s";
                }
            }, 1000);
        }
    }

    // ==========================
    // LINKVERTISE -> BYPASS
    // ==========================
    function checkLinkvertise() {
        if (location.hostname.includes("linkvertise.com")) {
            setStatus("Phát hiện Linkvertise → chuyển Bypass...", { color: "#ff9800", progress: 30 });
            location.replace(FIXED_BYPASS);
            return true;
        }
        return false;
    }

    if (checkLinkvertise()) return;

    // ==========================
    // MỞ LINK MINET (sạch, không referrer)
    // ==========================
    function openMinet(url) {
        if (openedMinet) return;
        openedMinet = true;
        setStatus("Mở link Minet...", { color: "#4caf50", progress: 50 });
        console.log("[Minet] Opening:", url);
        window.open(url, "_self", "noreferrer");
    }

    function isMinetTarget(url) {
        if (!url) return false;
        try {
            const u = new URL(url);
            return (
                u.hostname === "dashboard.minet.vn" &&
                u.pathname.startsWith("/earn/linkvertise")
            );
        } catch {
            return false;
        }
    }

    function scanForMinet() {
        if (openedMinet || !document.documentElement) return;

        const links = document.querySelectorAll("a[href]");
        for (const a of links) {
            if (isMinetTarget(a.href)) {
                setStatus("Tìm thấy link Minet!", { color: "#4caf50", progress: 45 });
                openMinet(a.href);
                return;
            }
        }

        const html = document.documentElement?.innerHTML || "";
        const match = html.match(
            /https:\/\/dashboard\.minet\.vn\/earn\/linkvertise[^\s"'<>]*/i
        );
        if (match) {
            setStatus("Tìm thấy link Minet!", { color: "#4caf50", progress: 45 });
            openMinet(match[0]);
        }
    }

    // ==========================
    // AUTO RESTART KHI VỀ TRANG EARN
    // ==========================
    let restartScheduled = false;

    function watchEarnPage() {
        setInterval(() => {
            const url = location.href.replace(/\/$/, "");
            if (url === MINET_EARN) {
                if (restartScheduled) return;
                restartScheduled = true;
                setStatus("Về trang earn → chờ restart...", {
                    color: "#f44336",
                    progress: 100,
                    countdown: 30,
                    sub: "sẽ mở lại sau 30s"
                });
                console.log("[Minet] Về trang earn, chờ 30s rồi mở lại linkvertise...");
                sleep(30000).then(() => {
                    restartScheduled = false;
                    openedMinet = false;
                    setStatus("Mở lại Linkvertise...", { color: "#4caf50", progress: 10 });
                    window.open(MINET_TARGET, "_self", "noreferrer");
                });
            } else {
                restartScheduled = false;
            }
        }, 2000);
    }

    // ==========================
    // AUTO CLICK CONTINUE
    // ==========================
    async function clickContinue() {
        if (clickedContinue) return true;

        const btn = document.querySelector("#nextBtn");
        if (!btn) return false;

        const text = (btn.textContent || btn.innerText || "").trim();
        const canClick =
            /Continue\s+to\s+Stage\s+\d+/i.test(text) &&
            !btn.disabled &&
            btn.offsetWidth > 0 &&
            btn.offsetHeight > 0;

        if (canClick) {
            clickedContinue = true;
            setStatus("Chờ 3s → click " + text, {
                color: "#ff9800",
                progress: 80,
                countdown: 3
            });
            console.log("[Minet] Waiting 3s then clicking:", text);
            await sleep(3000);

            btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            btn.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
            btn.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
            btn.click();

            setStatus("Đã click " + text + " ✓", { color: "#4caf50", progress: 90 });
            setTimeout(() => { clickedContinue = false; }, 5000);
            return true;
        }

        return false;
    }

    function startMinetAutomation() {
        setStatus("Trang Minet — đang chờ nút...", { color: "#378ADD", progress: 60 });

        const fastInterval = setInterval(async () => {
            if (await clickContinue()) clearInterval(fastInterval);
            checkLinkvertise();
            scanForMinet();
        }, 200);

        const minetObserver = new MutationObserver(async () => {
            await clickContinue();
            checkLinkvertise();
            scanForMinet();
        });

        minetObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["disabled", "class", "style"]
        });

        setInterval(async () => {
            await clickContinue();
            checkLinkvertise();
            scanForMinet();
        }, 1000);
    }

    // ==========================
    // AUTO CLICK START BYPASS
    // ==========================
    async function clickStartBypass() {
        if (bypassClicked) return true;

        const buttons = document.querySelectorAll("button");
        for (const btn of buttons) {
            const text    = (btn.textContent || btn.innerText || "").trim();
            const visible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
            const enabled = !btn.disabled;

            if (text.includes("Start Bypass") && visible && enabled) {
                bypassClicked = true;
                setStatus("Chờ 3s → click Start Bypass", {
                    color: "#ff9800",
                    progress: 55,
                    countdown: 3
                });
                console.log("[Bypass] Waiting 3s then clicking Start");
                await sleep(3000);

                btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                btn.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
                btn.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
                btn.click();

                setStatus("Đã click Start Bypass ✓ — chờ link kết quả...", {
                    color: "#4caf50",
                    progress: 65
                });
                return true;
            }
        }
        return false;
    }

    function startBypassAutomation() {
        setStatus("Trang Bypass — chờ nút Start...", { color: "#378ADD", progress: 40 });

        const fastInterval = setInterval(async () => {
            if (await clickStartBypass()) clearInterval(fastInterval);
            scanForMinet();
        }, 200);

        const bypassObserver = new MutationObserver(async () => {
            await clickStartBypass();
            scanForMinet();
        });

        bypassObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
        });

        setInterval(async () => {
            await clickStartBypass();
            scanForMinet();
        }, 1000);
    }

    // ==========================
    // MAIN
    // ==========================
    function init() {
        createOverlay();

        if (location.hostname.includes("bypass.tools")) {
            setStatus("Bypass.tools — chờ Start...", { color: "#378ADD", progress: 35 });
            startBypassAutomation();
            return;
        }

        if (location.href.startsWith(MINET_TARGET)) {
            setStatus("Trang Minet — đang xử lý...", { color: "#378ADD", progress: 60 });
            startMinetAutomation();
            return;
        }

        setStatus("Đang quét trang...", { color: "#888", progress: 5, sub: location.hostname });

        const pageObserver = new MutationObserver(() => { scanForMinet(); });
        pageObserver.observe(document.documentElement, {
            childList: true, subtree: true, characterData: true
        });

        scanForMinet();
        setInterval(() => { scanForMinet(); }, 500);
    }

    watchEarnPage();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
