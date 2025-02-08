function BoatsApp() {
    this.app = boatRentalApp;
}

BoatsApp.prototype.init = async function () {
    await this.app.waitForContractInit();
    this.loadBoats();
};

BoatsApp.prototype.loadBoats = async function () {
    console.log("📡 Fetching boats...");
    document.getElementById("boatListings").innerHTML = "<p>Loading boats...</p>";

    try {
        let boatCount = await this.app.contract.boatCount();
        console.log("Total Boats:", boatCount.toNumber());

        if (boatCount.toNumber() === 0) {
            document.getElementById("boatListings").innerHTML = "<p>No boats available.</p>";
            return;
        }

        document.getElementById("boatListings").innerHTML = "<div class='row row-cols-1 row-cols-md-4 g-4'>";

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

            const listing = `
                <div class="col-md-3">
                    <div class="card shadow-lg h-100">
                        <img src="${boatImageUrl}" class="card-img-top" alt="Boat Image" onerror="this.onerror=null; this.src='fallback-image.jpg';">
                        <div class="card-body text-center">
                            <h5 class="card-title">${boat[3]}</h5>
                            <p class="card-text text-muted">${boat[4]}</p>
                            <p><strong>Price:</strong> ${pricePerSecond} ETH/sec</p>
                            <p><strong>Deposit:</strong> ${depositAmount} ETH</p>
                            <p><strong>Owner:</strong> ${boat[2].substring(0, 6)}...${boat[2].slice(-4)}</p>
                            <p>${statusBadgeMap[boatStatus]}</p>
                            ${rentSection}
                        </div>
                    </div>
                </div>
            `;
            document.getElementById("boatListings").innerHTML += listing;
        }

        document.getElementById("boatListings").innerHTML += "</div>";

    } catch (error) {
        console.error("❌ Error fetching boats:", error);
        document.getElementById("boatListings").innerHTML = "<p>Failed to load boats.</p>";
    }
};

const boatsApp = new BoatsApp();
window.addEventListener("DOMContentLoaded", () => boatsApp.init());
