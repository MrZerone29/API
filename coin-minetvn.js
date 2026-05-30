// ==UserScript==
// @name         Minet Auto Continue + Auto Bypass
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Auto open Minet earn/linkvertise, click Continue, redirect bypass, click Start Bypass
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const MINET_TARGET = "https://dashboard.minet.vn/earn/linkvertise";

    const FIXED_BYPASS =
        "https://bypass.tools/vi/bypass?url=https%3A%2F%2Flinkvertise.com%2F380094%2Fygg9q9CsHDLy%3Fo%3Dsharing";

    let openedMinet = false;
    let clickedContinue = false;
    let bypassClicked = false;

    // ==========================
    // LINKVERTISE -> BYPASS
    // ==========================
    function checkLinkvertise() {
        if (location.hostname.includes("linkvertise.com")) {
            console.log("[Linkvertise] Redirecting bypass...");
            location.replace(FIXED_BYPASS);
            return true;
        }
        return false;
    }

    if (checkLinkvertise()) return;

    // ==========================
    // MỞ LINK MINET (chính xác)
    // ==========================
    function openMinet(url) {
        if (openedMinet) return;
        openedMinet = true;
        console.log("[Minet] Found:", url);

        // Mở sạch, không có referrer
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noreferrer noopener";
        a.target = "_self";
        a.click();
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

        // Tìm qua thẻ <a>
        const links = document.querySelectorAll("a[href]");
        for (const a of links) {
            if (isMinetTarget(a.href)) {
                openMinet(a.href);
                return;
            }
        }

        // Tìm qua innerHTML (regex chính xác hơn)
        const html = document.documentElement?.innerHTML || "";
        const match = html.match(
            /https:\/\/dashboard\.minet\.vn\/earn\/linkvertise[^\s"'<>]*/i
        );
        if (match) {
            openMinet(match[0]);
        }
    }

    // ==========================
    // AUTO CLICK CONTINUE
    // ==========================
    function clickContinue() {
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
            console.log("[Minet] Clicking:", text);

            btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            btn.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
            btn.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
            btn.click();

            setTimeout(() => { clickedContinue = false; }, 5000);
            return true;
        }

        return false;
    }

    function startMinetAutomation() {
        const fastInterval = setInterval(() => {
            if (clickContinue()) clearInterval(fastInterval);
            checkLinkvertise();
        }, 200);

        const minetObserver = new MutationObserver(() => {
            clickContinue();
            checkLinkvertise();
        });

        minetObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["disabled", "class", "style"]
        });

        setInterval(() => {
            clickContinue();
            checkLinkvertise();
        }, 1000);
    }

    // ==========================
    // AUTO CLICK START BYPASS
    // ==========================
    function clickStartBypass() {
        if (bypassClicked) return true;

        const buttons = document.querySelectorAll("button");
        for (const btn of buttons) {
            const text    = (btn.textContent || btn.innerText || "").trim();
            const visible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
            const enabled = !btn.disabled;

            if (text.includes("Start Bypass") && visible && enabled) {
                bypassClicked = true;
                console.log("[Bypass] Clicking Start");

                btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                btn.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
                btn.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
                btn.click();

                return true;
            }
        }
        return false;
    }

    function startBypassAutomation() {
        const fastInterval = setInterval(() => {
            if (clickStartBypass()) clearInterval(fastInterval);
            scanForMinet(); // ← tìm link kết quả sau khi bypass xong
        }, 200);

        const bypassObserver = new MutationObserver(() => {
            clickStartBypass();
            scanForMinet(); // ← link hiện ra là mở luôn
        });

        bypassObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
        });

        setInterval(() => {
            clickStartBypass();
            scanForMinet(); // ← backup poll
        }, 1000);
    }

    // ==========================
    // MAIN
    // ==========================
    function init() {
        // bypass.tools
        if (location.hostname.includes("bypass.tools")) {
            console.log("[Bypass] Active");
            startBypassAutomation();
            return;
        }

        // Đang ở đúng trang minet target
        if (location.href.startsWith(MINET_TARGET)) {
            console.log("[Minet] Active");
            startMinetAutomation();
            return;
        }

        // Web khác -> tìm link minet target
        const pageObserver = new MutationObserver(() => {
            scanForMinet();
        });

        pageObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });

        scanForMinet();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
