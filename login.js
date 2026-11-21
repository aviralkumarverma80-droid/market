"use strict";

const authElements = {
  tabs: document.getElementById("auth-tabs"),
  signInTab: document.getElementById("signin-tab"),
  signUpTab: document.getElementById("signup-tab"),
  title: document.getElementById("auth-title"),
  description: document.getElementById("auth-description"),
  message: document.getElementById("auth-message"),
  form: document.getElementById("auth-form"),
  emailField: document.getElementById("email-field"),
  email: document.getElementById("auth-email"),
  passwordField: document.getElementById("password-field"),
  passwordLabel: document.getElementById("password-label"),
  password: document.getElementById("auth-password"),
  confirmField: document.getElementById("confirm-password-field"),
  confirmPassword: document.getElementById("auth-confirm-password"),
  submit: document.getElementById("auth-submit"),
  forgotPassword: document.getElementById("forgot-password"),
  backToSignIn: document.getElementById("back-to-signin")
};

const MODE_COPY = {
  signin: { title: "Welcome back", description: "Sign in to continue to your Marketfield workspace.", submit: "Sign in" },
  signup: { title: "Create your account", description: "Start building your personal market watchlist.", submit: "Create account" },
  reset: { title: "Reset your password", description: "We’ll email you a secure link to choose a new password.", submit: "Send reset link" },
  recovery: { title: "Choose a new password", description: "Set a new password for your Marketfield account.", submit: "Update password" }
};

let authClient = null;
let mode = "signin";

function showMessage(message, isError = false) {
  authElements.message.textContent = message;
  authElements.message.classList.toggle("error", isError);
  authElements.message.hidden = false;
}

function setMode(nextMode) {
  mode = nextMode;
  const copy = MODE_COPY[mode];
  const isSignIn = mode === "signin";
  const isSignUp = mode === "signup";
  const isReset = mode === "reset";
  const needsPassword = mode === "signin" || isSignUp || mode === "recovery";
  const needsConfirm = isSignUp || mode === "recovery";
  const needsEmail = mode !== "recovery";

  authElements.password.value = "";
  authElements.confirmPassword.value = "";
  authElements.title.textContent = copy.title;
  authElements.description.textContent = copy.description;
  authElements.submit.textContent = copy.submit;
  authElements.tabs.hidden = isReset || mode === "recovery";
  authElements.signInTab.classList.toggle("active", isSignIn);
  authElements.signUpTab.classList.toggle("active", isSignUp);
  authElements.signInTab.setAttribute("aria-pressed", String(isSignIn));
  authElements.signUpTab.setAttribute("aria-pressed", String(isSignUp));
  authElements.emailField.hidden = !needsEmail;
  authElements.email.required = needsEmail;
  authElements.passwordField.hidden = !needsPassword;
  authElements.password.required = needsPassword;
  authElements.password.autocomplete = isSignIn ? "current-password" : "new-password";
  authElements.confirmField.hidden = !needsConfirm;
  authElements.confirmPassword.required = needsConfirm;
  authElements.passwordLabel.textContent = mode === "recovery" ? "New password" : "Password";
  authElements.forgotPassword.hidden = !isSignIn;
  authElements.backToSignIn.hidden = isSignIn || isSignUp;
  authElements.message.hidden = true;
  authElements.message.textContent = "";
}

function setPending(isPending) {
  authElements.submit.disabled = isPending;
  authElements.submit.textContent = isPending ? "Please wait…" : MODE_COPY[mode].submit;
  authElements.signInTab.disabled = isPending;
  authElements.signUpTab.disabled = isPending;
  authElements.forgotPassword.disabled = isPending;
  authElements.backToSignIn.disabled = isPending;
}

async function initializeLogin() {
  authClient = await window.marketfieldAuth.getClient();
  if (!authClient) throw new Error("Supabase is not configured.");

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const recoveryRequested = search.get("mode") === "recovery" || hash.get("type") === "recovery";
  const { data, error } = await authClient.auth.getSession();
  if (error) throw error;

  if (recoveryRequested) {
    if (!data.session) {
      setMode("signin");
      showMessage("This password reset link is invalid or expired. Request a new one.", true);
      return;
    }
    setMode("recovery");
    return;
  }
  if (data.session) window.location.replace("./");
}

authElements.signInTab.addEventListener("click", () => setMode("signin"));
authElements.signUpTab.addEventListener("click", () => setMode("signup"));
authElements.forgotPassword.addEventListener("click", () => setMode("reset"));
authElements.backToSignIn.addEventListener("click", () => setMode("signin"));

authElements.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authClient) return;

  const email = authElements.email.value.trim();
  const password = authElements.password.value;
  if ((mode === "signup" || mode === "recovery") && password !== authElements.confirmPassword.value) {
    showMessage("The passwords do not match.", true);
    authElements.confirmPassword.focus();
    return;
  }

  setPending(true);
  try {
    if (mode === "signin") {
      const { error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace("./");
      return;
    }
    if (mode === "signup") {
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: new URL("./login.html", window.location.href).href }
      });
      if (error) throw error;
      if (data.session) window.location.replace("./");
      else {
        setMode("signin");
        showMessage("Account created. Check your email to confirm your address before signing in.");
      }
      return;
    }
    if (mode === "reset") {
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("./login.html?mode=recovery", window.location.href).href
      });
      if (error) throw error;
      showMessage("If an account exists for that email, a password reset link is on its way.");
      return;
    }
    const { error } = await authClient.auth.updateUser({ password });
    if (error) throw error;
    window.location.replace("./");
  } catch {
    const errorMessages = {
      signin: "Could not sign in. Check your email and password, then try again.",
      signup: "Could not create the account. Check the email and password requirements.",
      reset: "Could not send the reset email. Check the address and try again.",
      recovery: "Could not update the password. Request a new reset link and try again."
    };
    showMessage(errorMessages[mode], true);
  } finally {
    setPending(false);
  }
});

initializeLogin().catch(() => {
  authElements.tabs.hidden = true;
  authElements.form.hidden = true;
  showMessage("Could not connect to Supabase. Check the project configuration and reload.", true);
});
