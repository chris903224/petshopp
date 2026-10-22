(function () {
    const ACCOUNTS_KEY = "petShopLocalAccounts";
    const SESSION_KEY = "petShopLocalSession";
    const ITERATIONS = 120000;
    const encoder = new TextEncoder();

    function getAccounts() {
        const saved = localStorage.getItem(ACCOUNTS_KEY);
        if (saved === null) return [];
        const accounts = JSON.parse(saved);
        if (!Array.isArray(accounts)) {
            throw new Error("Saved account data is invalid. Clear the petShopLocalAccounts browser-storage entry to start over.");
        }
        return accounts;
    }

    function bytesToHex(bytes) {
        return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function hashPassword(password, salt) {
        const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: Uint8Array.from(salt.match(/.{2}/g), (byte) => parseInt(byte, 16)),
            iterations: ITERATIONS,
            hash: "SHA-256"
        }, key, 256);
        return bytesToHex(bits);
    }

    function showLoginError(message) {
        const messageElement = document.getElementById("loginMessage");
        if (messageElement) messageElement.textContent = message;
        else window.alert(message);
    }

    async function initializeLoginPage() {
        const form = document.getElementById("loginForm");
        if (!form) return;

        const emailInput = document.getElementById("loginEmail");
        const passwordInput = document.getElementById("loginPassword");
        const submitButton = document.getElementById("loginButton");
        const modeButton = document.getElementById("modeButton");
        const subtitle = document.getElementById("loginSubtitle");
        const passwordHelp = document.getElementById("passwordHelp");
        const wrapper = document.querySelector(".login-double-card");
        const formTitle = document.getElementById("formTitle");
        const modeLabel = document.getElementById("modeLabel");
        const togglePassword = document.getElementById("togglePassword");

        let creatingAccount = false;

        try {
            if (localStorage.getItem(SESSION_KEY)) {
                window.location.replace("index.html");
                return;
            }
        } catch (error) {
            showLoginError(error instanceof Error ? error.message : "Could not read local account data.");
            return;
        }

        if (togglePassword) {
            togglePassword.addEventListener("click", () => {
                const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
                passwordInput.setAttribute("type", type);
                togglePassword.textContent = type === "password" ? "👁️" : "🙈";
            });
        }

        modeButton.addEventListener("click", () => {
            creatingAccount = !creatingAccount;
            if (creatingAccount) {
                if(wrapper) wrapper.setAttribute("data-mode", "register");
                if(modeLabel) modeLabel.textContent = "CREATE ACCOUNT";
                if(formTitle) formTitle.textContent = "Join us today";
                subtitle.textContent = "Register a new employee account to start managing.";
                submitButton.innerHTML = '<span class="icon">👤+</span> Create account';
                modeButton.innerHTML = '<span class="icon">←</span> Back to sign in';
            } else {
                if(wrapper) wrapper.setAttribute("data-mode", "signin");
                if(modeLabel) modeLabel.textContent = "WELCOME BACK";
                if(formTitle) formTitle.textContent = "Welcome back";
                subtitle.textContent = "Glad to see you again. Log in to continue.";
                submitButton.innerHTML = '<span class="icon">→</span> Sign in';
                modeButton.innerHTML = '<span class="icon">👤+</span> Create an account';
            }
            passwordHelp.hidden = !creatingAccount;
            passwordInput.autocomplete = creatingAccount ? "new-password" : "current-password";
            passwordInput.minLength = creatingAccount ? 8 : 1;
            document.getElementById("loginMessage").textContent = "";
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            document.getElementById("loginMessage").textContent = "";
            submitButton.disabled = true;
            const originalBtnHTML = submitButton.innerHTML;
            submitButton.textContent = creatingAccount ? "Creating..." : "Signing in...";

            try {
                const email = emailInput.value.trim().toLowerCase();
                const password = passwordInput.value;
                const accounts = getAccounts();
                let account;

                if (creatingAccount) {
                    if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
                    if (accounts.some((item) => item.email === email)) throw new Error("An account with this email already exists. Sign in instead.");
                    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
                    account = { email, salt, passwordHash: await hashPassword(password, salt) };
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
                } else {
                    account = accounts.find((item) => item.email === email);
                    if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
                        throw new Error("Email or password is incorrect.");
                    }
                }

                localStorage.setItem(SESSION_KEY, JSON.stringify({ email: account.email }));
                window.location.replace("index.html");
            } catch (error) {
                showLoginError(error instanceof Error ? error.message : "Could not create account or sign in.");
                submitButton.disabled = false;
                submitButton.innerHTML = originalBtnHTML;
            }
        });
    }

    function initializeProtectedPage() {
        if (!document.body.hasAttribute("data-requires-login")) return;

        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
            if (!session || typeof session.email !== "string") {
                window.location.replace("login.html");
                return;
            }

            const emailLabel = document.getElementById("currentUserEmail");
            if (emailLabel) emailLabel.textContent = session.email;

            // =========================================
            // DROPDOWN TOGGLE LOGIC
            // =========================================
            const profileToggleBtn = document.getElementById("profileToggleBtn");
            const profileDropdownMenu = document.getElementById("profileDropdownMenu");
            
            if (profileToggleBtn && profileDropdownMenu) {
                profileToggleBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    profileDropdownMenu.classList.toggle("show");
                });

                document.addEventListener("click", (e) => {
                    if (!profileToggleBtn.contains(e.target) && !profileDropdownMenu.contains(e.target)) {
                        profileDropdownMenu.classList.remove("show");
                    }
                });
            }

            // =========================================
            // CUSTOM LOGOUT CONFIRMATION LOGIC
            // =========================================
            const logoutTriggerBtn = document.getElementById("logoutTriggerBtn");
            const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
            const logoutConfirmModal = document.getElementById("logoutConfirmModal");
            const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
            const actualLogoutBtn = document.getElementById("logoutButton");

            if (logoutConfirmModal) {
                // Dropdown Sign out trigger
                if (logoutTriggerBtn) {
                    logoutTriggerBtn.addEventListener("click", () => {
                        if (profileDropdownMenu) profileDropdownMenu.classList.remove("show");
                        logoutConfirmModal.classList.add("show");
                    });
                }

                // Sidebar Sign out trigger
                if (sidebarLogoutBtn) {
                    sidebarLogoutBtn.addEventListener("click", () => {
                        logoutConfirmModal.classList.add("show");
                    });
                }

                // Cancel button
                if (cancelLogoutBtn) {
                    cancelLogoutBtn.addEventListener("click", () => {
                        logoutConfirmModal.classList.remove("show");
                    });
                }

                // Confirm logout
                if (actualLogoutBtn) {
                    actualLogoutBtn.addEventListener("click", () => {
                        localStorage.removeItem(SESSION_KEY);
                        window.location.replace("login.html");
                    });
                }
            }

            // SYNC SESSION ACROSS TABS
            window.addEventListener("storage", (event) => {
                if (event.key === SESSION_KEY && event.newValue === null) {
                    window.location.replace("login.html");
                }
            });

            document.body.style.visibility = "visible";
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Could not verify the local account.");
            window.location.replace("login.html");
        }
    }

    initializeLoginPage();
    initializeProtectedPage();
})();