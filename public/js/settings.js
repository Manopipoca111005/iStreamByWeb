// Theme toggle
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
    });
}

// Load saved theme
const currentThemeToggle = document.querySelector('.theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if (currentThemeToggle) {
        currentThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// Mobile sidebar toggle
const hamburger = document.querySelector('.hamburger');
const sidebar = document.querySelector('.sidebar');
if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Function to setup profile dropdown (copied from home.js)
function setupProfileDropdown() {
    const userProfileIcon = document.querySelector(
        ".user-profile .fa-user-circle"
    );
    const profileDropdown = document.querySelector(".profile-dropdown");
    if (userProfileIcon && profileDropdown) {
        userProfileIcon.addEventListener("click", (event) => {
            event.stopPropagation();
            const isActive = profileDropdown.classList.toggle("active");
            userProfileIcon.setAttribute("aria-expanded", isActive.toString());
        });
        document.addEventListener("click", (event) => {
            if (
                !userProfileIcon.contains(event.target) &&
                !profileDropdown.contains(event.target) &&
                profileDropdown.classList.contains("active")
            ) {
                profileDropdown.classList.remove("active");
                userProfileIcon.setAttribute("aria-expanded", "false");
            }
        });
    }
}

// Theme toggle (repeated block - merged with the first one for clarity)
// This block appears to be a duplicate or a slightly modified version of the initial theme toggle.
// I've kept the initial one as it seems more complete with the load saved theme logic.
// If this was intended to be separate, please clarify.

const helpButton = document.querySelector(".help-button");
if (helpButton) {
    helpButton.addEventListener("click", () =>
        document.getElementById("tutorial-modal").showModal()
    );
}

const getStartedButton = document.getElementById("get-started-button");
if (getStartedButton) {
    getStartedButton.addEventListener("click", () => {
        showTutorial(); // Assuming showTutorial() is defined elsewhere
        const tutorialModal = document.getElementById("tutorial-modal");
        if (tutorialModal && tutorialModal.hasAttribute("open")) {
            tutorialModal.close();
        }
    });
}

function scrollCarousel(containerId, scrollAmount) {
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
}

// Save Real-Debrid API Token
const saveRealDebridSettingsButton = document.querySelector('.save-realdebrid-settings');
if (saveRealDebridSettingsButton) {
    saveRealDebridSettingsButton.addEventListener('click', () => {
        const realDebridApiToken = document.getElementById('realdebrid-api-token').value;
        const spinner = document.getElementById('realdebrid-loading');

        if (spinner) {
            spinner.classList.add('active');
            setTimeout(() => {
                spinner.classList.remove('active');
                localStorage.setItem('realDebridApiToken', realDebridApiToken);
                const notification = document.createElement('div');
                notification.className = 'notification success';
                notification.textContent = 'Real-Debrid API Token saved successfully!';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }, 1500);
        }
    });
}

// Load saved Real-Debrid API Token and setup dropdown on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const realDebridApiTokenInput = document.getElementById('realdebrid-api-token');
    if (realDebridApiTokenInput) {
        const savedToken = localStorage.getItem('realDebridApiToken');
        if (savedToken) {
            realDebridApiTokenInput.value = savedToken;
        }
    }

    // Call the setupProfileDropdown function here to initialize the profile dropdown
    setupProfileDropdown();
});