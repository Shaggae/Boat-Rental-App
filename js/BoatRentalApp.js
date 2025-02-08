class BoatRentalApp {
    constructor() {
        this.web3Provider = null;
        this.contract = null;
        this.account = null;
        this.contractAddress = "0x51158dc2c6798e69f141dd0b2a2c1e3aff9d7e6f"; // Update with your deployed contract address
        this.contractABI = [
            "function boatCount() public view returns (uint256)",
            "function getBoat(uint256) public view returns (uint256, string, address, string, string, uint256, uint256, uint8, address, uint256, string)",
            "function registerBoat(string, address, string, string, uint256, uint256, string) public",
            "function rentBoat(uint256, uint32) public payable",
            "function finalizeRental(uint256, bool) public",
            "function removeBoat(uint256) public",
            "function updateBoatStatus(uint256, bool) public"
        ];          
    }

    async init(requireWallet = false) {
        if (typeof window.ethereum !== "undefined") {
            this.web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            
            if (requireWallet) {
                await this.getAccounts(); 
                this.setupWalletCopyFeature();
                this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.web3Provider.getSigner());
            } else {
                this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.web3Provider);
            }
        } else {
            alert("🚨 MetaMask is not installed. Please install it to use this app.");
        }
    }
    
    async getAccounts() {
        try {
            const accounts = await this.web3Provider.send("eth_requestAccounts", []);
            if (accounts.length === 0) {
                console.warn("⚠️ No wallet accounts found!");
                return;
            }
    
            const walletAddressElement = document.getElementById("walletAddress");
            if (walletAddressElement) {
                walletAddressElement.setAttribute("data-full-address", accounts[0]); 
                walletAddressElement.innerText = accounts[0]; 
                console.log("✅ Wallet connected:", accounts[0]);
            }
        } catch (error) {
            console.error("❌ Error fetching accounts:", error);
        }
    }

    setupWalletCopyFeature() {
        console.log("🔍 setupWalletCopyFeature() called!");
        const walletCard = document.getElementById("walletCard");
        const walletAddressElement = document.getElementById("walletAddress");
    
        if (!walletCard || !walletAddressElement) {
            console.warn("⚠️ Wallet copy elements not found!");
            return;
        }
    
        walletCard.style.cursor = "pointer";
        walletCard.setAttribute("title", "Click to copy");
    
        walletCard.addEventListener("click", async () => {
            const fullAddress = walletAddressElement.getAttribute("data-full-address");
    
            if (!fullAddress || fullAddress.length < 10) {
                console.warn("⚠️ No wallet address available to copy!");
                return;
            }
    
            try {
                await navigator.clipboard.writeText(fullAddress);
                console.log("✅ Wallet address copied:", fullAddress);

                let tooltip = document.getElementById("copyTooltip");
                if (!tooltip) {
                    tooltip = document.createElement("div");
                    tooltip.id = "copyTooltip";
                    tooltip.className = "copy-tooltip";
                    tooltip.innerText = "Copied!";
                    document.body.appendChild(tooltip);
                }

                const rect = walletCard.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 30}px`;
    
                tooltip.classList.add("show");

                setTimeout(() => {
                    tooltip.classList.remove("show");
                }, 1500);
            } catch (err) {
                console.error("❌ Failed to copy wallet address:", err);
            }
        });
    }
    
    async logout() {
        console.log("🔌 Logging out...");
        localStorage.removeItem("walletAddress");
        this.account = null;
        document.getElementById("walletAddress").innerText = "Not connected";
        window.location.href = "login.html"; 
    }

    async waitForContractInit() {
        return new Promise((resolve) => {
            const checkContract = setInterval(() => {
                if (this.contract) {
                    clearInterval(checkContract);
                    resolve();
                }
            }, 100);
        });
    }
    
    showLoadingModal(status, message) {
        const modalElement = document.getElementById("loadingModal");
    
        if (!modalElement) {
            console.error("❌ Error: Loading modal not found in DOM.");
            return;
        }
    
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
    
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: "static",
            keyboard: false
        });
    
        const statusIcon = document.getElementById("loadingStatusIcon");
        const statusText = document.getElementById("loadingStatusText");
        const closeButton = document.getElementById("loadingCloseButton");
    
        closeButton.style.display = "none";
        closeButton.removeEventListener("click", boatRentalApp.closeLoadingModal);
        closeButton.addEventListener("click", () => boatRentalApp.closeLoadingModal());
    
        if (status === "loading") {
            statusIcon.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
            statusText.innerText = message || "Processing...";
        } else if (status === "success") {
            statusIcon.innerHTML = '<i class="bi bi-check-circle-fill text-success fs-1"></i>';
            statusText.innerText = message || "Operation successful!";
            closeButton.style.display = "block";
        } else {
            statusIcon.innerHTML = '<i class="bi bi-x-circle-fill text-danger fs-1"></i>';
            statusText.innerText = message || "Operation failed.";
            closeButton.style.display = "block";
        }
    
        modal.show();
    }    

    closeLoadingModal() {
        const modalElement = document.getElementById("loadingModal");
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    
        document.body.style.overflow = "auto";
        document.documentElement.style.overflow = "auto";
    
        setTimeout(() => {
            document.body.classList.remove("modal-open");
        }, 300); 
    }    
}

const boatRentalApp = new BoatRentalApp();
window.addEventListener("DOMContentLoaded", () => boatRentalApp.init());
