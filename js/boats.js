function BoatsApp() {
    this.app = boatRentalApp;
}

BoatsApp.prototype.init = async function () {
    await this.app.waitForContractInit();
    this.loadBoats();
};

BoatsApp.prototype.loadBoats = async function () {
    console.log("📡 Fetching boats...");
    const boatListingsContainer = document.getElementById("boatListings");
    boatListingsContainer.innerHTML = "<p>Loading boats...</p>";

    try {
        let boatCount = await this.app.contract.boatCount();
        console.log("Total Boats:", boatCount.toNumber());

        if (boatCount.toNumber() === 0) {
            document.getElementById("boatListings").innerHTML = "<p>No boats available.</p>";
            return;
        }

        boatListingsContainer.innerHTML = "<div class='row g-4'></div>";
        const boatRow = boatListingsContainer.querySelector(".row");

        const statusMap = ["Available", "Rented"];
        const statusBadgeMap = {
            "Available": `<span class="badge bg-success">Available</span>`,
            "Rented": `<span class="badge bg-warning">Rented</span>`
        };

        for (let i = 1; i <= boatCount.toNumber(); i++) {
            const boat = await this.app.contract.getBoat(i);
            if (!boat) continue;

            console.log(`Boat ${i} Data:`, boat);

            const boatStatus = statusMap[boat[7]];
            if (!boatStatus) continue;

            const boatImageUrl = `https://ipfs.io/ipfs/${boat[10]}`;
            const pricePerSecond = ethers.utils.formatEther(boat[5]);
            const depositAmount = ethers.utils.formatEther(boat[6]);

            const rentSection = `
                <button class="btn btn-primary w-100" onclick="window.location.href='login.html'">Rent</button>
            `;

            const boatCard = document.createElement("div");
            boatCard.classList.add("col-lg-4", "col-md-6", "col-sm-12");
            boatCard.setAttribute("data-boat-id", boat[0]);

            boatCard.innerHTML = `
                <div class="card boat-card shadow-lg h-100 d-flex flex-column">
                    <img src="${boatImageUrl}" class="card-img-top boat-image"
                        alt="Boat Image"
                        onerror="this.onerror=null; this.src='fallback-image.jpg';">
                    <div class="card-body text-center d-flex flex-column justify-content-between">
                        <h5 class="card-title">${boat[3]}</h5>
                        <p class="card-text boat-description">${boat[4]}</p>
                        <p><strong>Price:</strong> ${pricePerSecond} ETH/sec</p>
                        <p><strong>Deposit:</strong> ${depositAmount} ETH</p>
                        <p><strong>Owner:</strong> ${boat[2].substring(0, 6)}...${boat[2].slice(-4)}</p>
                        <p class="boat-status">${statusBadgeMap[boatStatus]}</p>
                        <div class="d-grid gap-2">${rentSection}</div>
                    </div>
                </div>
            `;

            boatRow.appendChild(boatCard);
        }

    } catch (error) {
        console.error("❌ Error fetching boats:", error);
        boatListingsContainer.innerHTML = "<p>Failed to load boats.</p>";
    }
};

const boatsApp = new BoatsApp();
window.addEventListener("DOMContentLoaded", () => boatsApp.init());
