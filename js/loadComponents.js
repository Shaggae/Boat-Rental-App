document.addEventListener("DOMContentLoaded", function () {
    fetch("navbar.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("navbar-placeholder").innerHTML = data;
            setupNavbar();
            attachLogoutListener();
        });

    fetch("footer.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("footer-placeholder").innerHTML = data;
        });
});

function setupNavbar() {
    const ownerWallet = "0x8274DFd24409A19D2A10d249B9413953bf431DC7"; 
    const customerWallet = "0xAcEe3f8a0e0D36B652c81Bf74c6Cd71842cB7d00"; 

    const userWallet = localStorage.getItem("walletAddress");
    const rentTab = document.querySelector(".rent-tab"); 
    const rentCustomerTab = document.querySelector(".rent-customer-tab"); 
    const ownerDashboardTab = document.querySelector(".owner-dashboard-tab");
    const loginBtn = document.querySelector(".login-btn");
    const logoutBtn = document.querySelector(".logout-btn");

    if (userWallet) {
        loginBtn.classList.add("d-none");
        logoutBtn.classList.remove("d-none");

        if (userWallet.toLowerCase() === ownerWallet.toLowerCase()) {
            rentTab.classList.add("d-none"); 
            rentCustomerTab.classList.add("d-none"); 
            ownerDashboardTab.classList.remove("d-none");
        } else if (userWallet.toLowerCase() === customerWallet.toLowerCase()) {
            ownerDashboardTab.classList.add("d-none"); 
            rentTab.classList.add("d-none"); 
            rentCustomerTab.classList.remove("d-none"); 
        }
    } else {
        loginBtn.classList.remove("d-none");
        logoutBtn.classList.add("d-none");
        rentTab.classList.remove("d-none");
        rentCustomerTab.classList.add("d-none");
        ownerDashboardTab.classList.add("d-none");
    }
}

function attachLogoutListener() {
    const logoutButton = document.querySelector(".logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            localStorage.removeItem("walletAddress"); 
            window.location.href = "login.html"; 
        });
    } else {
        console.warn("⚠️ Warning: Logout button not found. Navbar may not have loaded yet.");
    }
}