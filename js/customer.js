let customerApp;

function CustomerApp() {
    this.app = boatRentalApp;
}

CustomerApp.prototype.init = async function () {
    await boatRentalApp.waitForContractInit();
    this.loadBoats();
    this.startRentalStatusUpdate();
    boatRentalApp.setupWalletCopyFeature();
};

CustomerApp.prototype.rentBoat = async function (boatId, rentalPricePerSecond, depositAmount) {
    await this.app.waitForContractInit();

    try {
        const rentalDurationInput = document.getElementById(`rentalDuration-${boatId}`);
        const rentalDuration = parseInt(rentalDurationInput.value);
        if (!rentalDuration || rentalDuration <= 0) {
            alert("Please enter a valid rental duration.");
            return;
        }

        const rentalFeeBN = ethers.utils.parseEther((rentalPricePerSecond * rentalDuration).toString());
        const depositBN = ethers.utils.parseEther(depositAmount.toString());
        const totalAmountBN = rentalFeeBN.add(depositBN);

        console.log(`⏳ Rental Duration: ${rentalDuration} seconds`);
        console.log(`🔹 Rental Fee: ${ethers.utils.formatEther(rentalFeeBN)} ETH`);
        console.log(`🔹 Deposit Amount: ${ethers.utils.formatEther(depositBN)} ETH`);
        console.log(`🔹 Total Amount Sent: ${ethers.utils.formatEther(totalAmountBN)} ETH`);

        this.app.showLoadingModal("loading", "Processing rental...");

        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const tx = await contractWithSigner.rentBoat(boatId, rentalDuration, {
            value: totalAmountBN
        });

        console.log("⏳ Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed:", receipt);

        this.app.showLoadingModal("success", "Boat rented successfully!");

        await this.updateBoatStatusUI(boatId);

    } catch (error) {
        console.error("❌ Error renting boat:", error);
        this.app.showLoadingModal("error", "Rental failed.");
    }
};

CustomerApp.prototype.updateBoatStatusUI = async function (boatId) {
    console.log(`🔄 Updating UI for boat ID: ${boatId}`);

    const boatElement = document.querySelector(`[data-boat-id="${boatId}"]`);
    if (!boatElement) {
        console.warn(`⚠️ Boat element with ID '${boatId}' not found!`);
        return;
    }

    try {
        const updatedBoat = await this.getBoat(boatId);
        if (!updatedBoat) {
            console.error(`❌ Failed to fetch updated boat details for ID ${boatId}`);
            return;
        }

        const newBoatCard = this.createBoatCard(updatedBoat);

        boatElement.replaceWith(newBoatCard);
        console.log(`✅ Boat UI updated successfully!`);

    } catch (error) {
        console.error(`❌ Error updating boat UI:`, error);
    }
};

CustomerApp.prototype.getBoat = async function (boatId) {
    await this.app.waitForContractInit();

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const boat = await contractWithSigner.getBoat(boatId);
        return boat;
    } catch (error) {
        console.error(`❌ Error fetching boat ${boatId}:`, error);
        return null;
    }
};

CustomerApp.prototype.loadBoats = async function () {
    await this.app.waitForContractInit();

    console.log("📡 Fetching boats...");
    document.getElementById("boatListings").innerHTML = "<p>Loading boats...</p>";

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        let boatCount = await contractWithSigner.boatCount();
        console.log("Total Boats:", boatCount.toNumber());

        if (boatCount.toNumber() === 0) {
            document.getElementById("boatListings").innerHTML = "<p>No boats available.</p>";
            return;
        }

        document.getElementById("boatListings").innerHTML = "<div class='row g-4'></div>";
        const boatRow = document.getElementById("boatListings").querySelector(".row");

        for (let i = 1; i <= boatCount.toNumber(); i++) {
            const boat = await contractWithSigner.getBoat(i);
            if (!boat) continue;

            console.log(`Boat ${i} Data:`, boat);

            if (boat[7] === 2) {
                console.log(`⏩ Skipping unavailable boat ID: ${boat[0]}`);
                continue;
            }

            const boatCard = this.createBoatCard(boat);
            boatRow.appendChild(boatCard);
        }

        this.attachRentButtonListeners();

    } catch (error) {
        console.error("❌ Error fetching boat count:", error);
        document.getElementById("boatListings").innerHTML = "<p>Failed to load boats.</p>";
    }
};

CustomerApp.prototype.attachRentButtonListeners = function () {
    document.querySelectorAll('.rent-btn').forEach(button => {
        button.addEventListener("click", function () {
            const boatId = this.getAttribute("data-boatid");
            const rentalPricePerSecond = this.getAttribute("data-rentalprice");
            const depositAmount = this.getAttribute("data-deposit");
            customerApp.rentBoat(boatId, rentalPricePerSecond, depositAmount);
        });
    });
};

CustomerApp.prototype.createBoatCard = function (boat) {
    const statusMap = ["Available", "Rented", "Unavailable"];
    const statusColors = ["success", "warning", "secondary"];
    const boatStatus = statusMap[boat[7]];
    const statusColor = statusColors[boat[7]];
    const boatImageUrl = `https://ipfs.io/ipfs/${boat[10]}`;
    const pricePerSecond = ethers.utils.formatEther(boat[5]);
    const depositAmount = ethers.utils.formatEther(boat[6]);
    const boatId = boat[0];

    const currentTime = Math.floor(Date.now() / 1000);
    const rentalEndTime = boat[9] > 0 ? new Date(boat[9] * 1000).toLocaleString() : "N/A";
    const isActive = boat[9] > currentTime;
    const timeDisplay = isActive
        ? `<span class="text-success fw-bold">(Active)</span>`
        : `<span class="text-danger fw-bold">(Expired)</span>`;

    let rentalInfo = "";
    if (boatStatus === "Rented") {
        rentalInfo = `
            <p class="fw-bold text-dark mb-0">Rental Ends:</p>
            <p id="rental-status-${boatId}" class="fw-bold text-dark">${rentalEndTime} ${timeDisplay}</p>
        `;
    }

    const rentSection = boatStatus === "Available"
        ? `
            <div class="rent-controls">
                <label for="rentalDuration-${boatId}" class="form-label">Rental Duration (seconds):</label>
                <input type="number" id="rentalDuration-${boatId}" min="1" placeholder="Enter rental time" class="form-control mb-2" oninput="updateTotalPrice(${boatId}, ${pricePerSecond}, ${depositAmount})">
                <p id="totalPrice-${boatId}" class="text-muted"><strong>Total:</strong> 0 ETH</p>
                <button class="btn btn-primary w-100 rent-btn" data-boatid="${boatId}" data-rentalprice="${pricePerSecond}" data-deposit="${depositAmount}">Rent</button>
            </div>
          `
        : rentalInfo;

    const boatCard = document.createElement("div");
    boatCard.classList.add("col-lg-4", "col-md-6", "col-sm-12");
    boatCard.setAttribute("data-boat-id", boatId);

    boatCard.innerHTML = `
        <div class="card boat-card shadow-lg h-100 d-flex flex-column">
            <img src="${boatImageUrl}" class="card-img-top boat-image"
                alt="Boat Image"
                onerror="this.onerror=null; this.src='fallback-image.jpg';">
            <div class="card-body text-center d-flex flex-column justify-content-between">
                <div>
                    <h5 class="card-title">${boat[3]}</h5>
                    <p class="card-text text-muted">${boat[4]}</p>
                    <p><strong>Price:</strong> ${pricePerSecond} ETH/sec</p>
                    <p><strong>Deposit:</strong> ${depositAmount} ETH</p>
                    <p><strong>Owner:</strong> ${boat[2].substring(0, 6)}...${boat[2].slice(-4)}</p>
                    <p class="boat-status"><span class="badge bg-${statusColor}">${boatStatus}</span></p>
                </div>
                ${rentSection}
            </div>
        </div>
    `;

    return boatCard;
};

CustomerApp.prototype.startRentalStatusUpdate = function () {
    setInterval(async () => {
        document.querySelectorAll("[data-boat-id]").forEach(async (boatElement) => {
            const boatId = boatElement.getAttribute("data-boat-id");
            const updatedBoat = await this.getBoat(boatId);

            if (updatedBoat && updatedBoat[7] === 1) { 
                const currentTime = Math.floor(Date.now() / 1000);
                const rentalEndTimestamp = updatedBoat[9];

                if (rentalEndTimestamp <= currentTime) {
                    console.log(`⏳ Rental for Boat ID ${boatId} has expired! Updating UI...`);
                    await this.updateBoatStatusUI(boatId);
                }
            }
        });
    }, 5000);
};

function updateTotalPrice(boatId, rentalPricePerSecond, depositAmount) {
    const rentalDuration = document.getElementById(`rentalDuration-${boatId}`).value;
    if (!rentalDuration || rentalDuration <= 0) {
        document.getElementById(`totalPrice-${boatId}`).innerHTML = `<strong>Total Price:</strong> 0 ETH`;
        return;
    }

    const totalAmount = (parseFloat(rentalPricePerSecond) * rentalDuration) + parseFloat(depositAmount);
    document.getElementById(`totalPrice-${boatId}`).innerHTML = `<strong>Total Price:</strong> ${totalAmount.toFixed(5)} ETH`;
}

window.addEventListener("DOMContentLoaded", async () => {
    await boatRentalApp.getAccounts();
    customerApp = new CustomerApp();
    customerApp.init();
});
