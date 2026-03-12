import { getCurrentUser, signInWithGoogle } from "./auth/client";

async function init() {
  // Check if already authenticated
  const user = await getCurrentUser();
  if (user) {
    if (user.username) {
      window.location.href = `/u/${user.username}/`;
    } else {
      window.location.href = "/onboarding.html";
    }
    return;
  }

  // Set up sign-in button
  const btn = document.getElementById("google-signin");
  btn?.addEventListener("click", () => {
    signInWithGoogle();
  });
}

init();
