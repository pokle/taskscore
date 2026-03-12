import { getCurrentUser, signOut } from "./auth/client";

async function init() {
  const user = await getCurrentUser();

  // Guard: not authenticated
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // Guard: no username yet
  if (!user.username) {
    window.location.href = "/onboarding.html";
    return;
  }

  // Show dashboard
  const container = document.getElementById("dashboard")!;
  container.classList.remove("hidden");

  document.getElementById("display-name")!.textContent = user.name;

  // Sign out
  document.getElementById("signout-btn")?.addEventListener("click", async () => {
    await signOut();
    window.location.href = "/";
  });
}

init();
