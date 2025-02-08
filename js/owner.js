let ownerApp;

function OwnerApp() {
    this.app = boatRentalApp;
}

async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJlN2ZhMGI2NC1mMWRiLTQwYjYtOWNmNi05ZWVkMjcwZjY1ZWMiLCJlbWFpbCI6InQudW1hdGhvcm5AZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImZlYTM1NGMxNTk4YmI3ODExMWNmIiwic2NvcGVkS2V5U2VjcmV0IjoiZTIyNzEyNmNlYjIwZjg1NDJhYzg4MDc0YzY2NjQ1NDI0ZWJjYjk1ZmMxNmMwMzU1NDg0YmI4ZDNmOTRiY2Q2MyIsImV4cCI6MTc3MDM1NDE4OH0.wamo6_KlzgsNNHVZB5EDCAYHy36Eg8N3Fp1tatdjQXs"
        },
        body: formData
    });

    if (!response.ok) {
        console.error("❌ Pinata upload failed:", await response.text());
        throw new Error("Failed to upload image to IPFS");
    }

    const data = await response.json();
    if (!data.IpfsHash) {
        throw new Error("Invalid Pinata response");
    }

    return data.IpfsHash;
}

OwnerApp.prototype.init = async function () {
    await this.app.waitForContractInit();
    this.loadOwnerBoats();
    this.loadOwnerStats(); 
    this.injectBoatListingModal();
    this.updateDashboardStats();
    this.startRentalStatusUpdate();   
    boatRentalApp.setupWalletCopyFeature();
};

OwnerApp.prototype.injectBoatListingModal = function () {
    const modalHTML = `
        <div class="modal fade" id="addBoatModal" tabindex="-1" aria-labelledby="addBoatModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold">List a New Boat</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="listBoatForm">
                            <div class="mb-3">
                                <label for="boatName" class="form-label">Boat Name</label>
                                <input type="text" class="form-control" id="boatName" required>
                            </div>
                            <div class="mb-3">
                                <label for="description" class="form-label">Description</label>
                                <textarea class="form-control" id="description" rows="3" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label for="rentalPrice" class="form-label">Rental Price (ETH per sec)</label>
                                <input type="number" class="form-control" id="rentalPrice" required>
                            </div>
                            <div class="mb-3">
                                <label for="depositAmount" class="form-label">Deposit Amount (ETH)</label>
                                <input type="number" class="form-control" id="depositAmount" required>
                            </div>
                            <div class="mb-3">
                                <label for="boatImage" class="form-label">Upload Boat Image</label>
                                <input type="file" class="form-control" id="boatImage" accept="image/*" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">List Boat</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    document.getElementById("listBoatForm").addEventListener("submit", (event) => this.listBoat(event));
};

OwnerApp.prototype.listBoat = async function (event) {
    event.preventDefault();
    await this.app.waitForContractInit();

    const listBoatForm = document.getElementById("listBoatForm");
    const boatName = document.getElementById("boatName").value;
    const description = document.getElementById("description").value;
    const rentalPrice = ethers.utils.parseEther(document.getElementById("rentalPrice").value);
    const depositAmount = ethers.utils.parseEther(document.getElementById("depositAmount").value);
    const boatImageFile = document.getElementById("boatImage").files[0];

    if (!boatImageFile) {
        alert("Please upload an image.");
        return;
    }

    const listBoatModalElement = document.getElementById("addBoatModal");
    const listBoatModal = bootstrap.Modal.getInstance(listBoatModalElement);
    if (listBoatModal) {
        listBoatModal.hide();
    }

    listBoatForm.reset();

    this.app.showLoadingModal("loading", "Listing boat on the blockchain...");

    try {
        const imageIPFSHash = await uploadToIPFS(boatImageFile);
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const tx = await contractWithSigner.registerBoat("Owner", this.app.account, boatName, description, rentalPrice, depositAmount, imageIPFSHash);
        await tx.wait();
        
        this.app.showLoadingModal("success", "Boat listed successfully!");

        const boatCount = await contractWithSigner.boatCount();
        const newBoat = await contractWithSigner.getBoat(boatCount.toNumber());

        this.addBoatToUI(newBoat);

        this.updateDashboardStats();

    } catch (error) {
        console.error("❌ Error listing boat:", error);
        this.app.showLoadingModal("error", "Failed to list boat.");
    }
};

OwnerApp.prototype.addBoatToUI = function (boat) {
    console.log(`🛥️ Adding new boat to UI: ${boat[3]}`);

    const ownerBoatListings = document.getElementById("ownerBoatListings");

    let boatRow = ownerBoatListings.querySelector(".row");
    if (!boatRow) {
        console.warn("⚠️ Boat listing row not found! Creating a new row...");
        boatRow = document.createElement("div");
        boatRow.classList.add("row", "g-4");
        ownerBoatListings.appendChild(boatRow);
    }

    const boatCard = this.createBoatCard(boat);
    boatRow.appendChild(boatCard);

    console.log("✅ Boat added to UI successfully!");
};


OwnerApp.prototype.finalizeRental = async function (boatId) {
    await this.app.waitForContractInit();

    const refundDeposit = document.getElementById(`depositAction-${boatId}`).value === "true";
    let damageReason = "";

    if (!refundDeposit) {
        const reasonDropdown = document.getElementById(`damageReason-${boatId}`);
        const otherReasonInput = document.getElementById(`otherDamageReason-${boatId}`);

        if (!reasonDropdown || !otherReasonInput) {
            alert("⚠️ Error: Reason selection elements not found!");
            return;
        }

        if (reasonDropdown.value === "Other") {
            damageReason = otherReasonInput.value.trim();
        } else {
            damageReason = reasonDropdown.value;
        }

        if (!damageReason) {
            alert("⚠️ Please select or specify a reason for keeping the deposit.");
            return;
        }
    }

    this.app.showLoadingModal("loading", "Finalizing rental...");

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const tx = await contractWithSigner.finalizeRental(boatId, refundDeposit);
        await tx.wait();

        this.app.showLoadingModal("success", "Rental finalized successfully!");

        const updatedBoat = await contractWithSigner.getBoat(boatId);

        document.getElementById("loadingCloseButton").addEventListener("click", function () {
            ownerApp.replaceBoatCardInUI(updatedBoat);
            ownerApp.updateDashboardStats();
        }, { once: true });

    } catch (error) {
        console.error("❌ Error finalizing rental:", error);
        this.app.showLoadingModal("error", "Error finalizing rental.");
    }
};

OwnerApp.prototype.replaceBoatCardInUI = function (boat) {
    const boatId = boat[0];
    const boatElement = document.querySelector(`[data-boat-id="${boatId}"]`);

    if (!boatElement) {
        console.warn(`⚠️ Boat element with ID '${boatId}' not found!`);
        return;
    }

    boatElement.innerHTML = this.createBoatCard(boat).innerHTML;

    const depositAction = document.getElementById(`depositAction-${boatId}`);
    if (depositAction) {
        depositAction.addEventListener("change", () => this.showDamageReasonDropdown(boatId));
    }

    console.log(`✅ Boat ${boatId} updated in UI.`);
};

OwnerApp.prototype.updateRentalEndStatus = function (boatId, rentalEndTimestamp) {
    const rentalStatusElement = document.getElementById(`rental-status-${boatId}`);
    const finalizeButtonContainer = document.getElementById(`rentalControls-${boatId}`);

    if (!rentalStatusElement) {
        console.warn(`⚠️ Rental status element for Boat ${boatId} not found!`);
        return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime >= rentalEndTimestamp;

    if (isExpired) {
        rentalStatusElement.innerHTML = `${new Date(rentalEndTimestamp * 1000).toLocaleString()} <span class="text-danger fw-bold">(Expired)</span>`;
        
        if (finalizeButtonContainer && !document.getElementById(`finalizeRentalButton-${boatId}`)) {
            finalizeButtonContainer.innerHTML += `
                <button id="finalizeRentalButton-${boatId}" class="btn btn-primary w-100 mt-3" onclick="ownerApp.finalizeRental(${boatId})">
                    Finalize Rental
                </button>
            `;
        }
    }
};

OwnerApp.prototype.startRentalStatusUpdate = function () {
    setInterval(() => {
        document.querySelectorAll("[data-boat-id]").forEach((boat) => {
            const boatId = boat.getAttribute("data-boat-id");
            const rentalEndTimestamp = parseInt(boat.getAttribute("data-rental-end"));

            if (!rentalEndTimestamp) return;

            const currentTime = Math.floor(Date.now() / 1000);
            const isExpired = currentTime >= rentalEndTimestamp;

            const rentalStatusElement = document.getElementById(`rental-status-${boatId}`);
            const finalizeButton = document.getElementById(`finalizeRentalButton-${boatId}`);

            if (rentalStatusElement) {
                rentalStatusElement.innerHTML = `
                    ${new Date(rentalEndTimestamp * 1000).toLocaleString()} 
                    <span class="text-${isExpired ? "danger" : "success"} fw-bold">
                        (${isExpired ? "Expired" : "Active"})
                    </span>
                `;
            }

            if (isExpired && finalizeButton) {
                finalizeButton.style.display = "block";
            }
        });
    }, 5000); 
};

OwnerApp.prototype.toggleOtherReason = function (boatId) {
    const reasonDropdown = document.getElementById(`damageReason-${boatId}`);
    const otherReasonContainer = document.getElementById(`otherDamageReasonContainer-${boatId}`);

    if (!reasonDropdown || !otherReasonContainer) {
        console.warn(`⚠️ Missing elements for Boat ID ${boatId}`);
        return;
    }

    console.log(`🔄 Toggling Other Reason for Boat ID: ${boatId}, Selected: ${reasonDropdown.value}`);

    otherReasonContainer.style.display = reasonDropdown.value === "Other" ? "block" : "none";
};

OwnerApp.prototype.showDamageReasonDropdown = function (boatId) {
    const depositAction = document.getElementById(`depositAction-${boatId}`);
    const reasonContainer = document.getElementById(`damageReasonContainer-${boatId}`);
    const reasonDropdown = document.getElementById(`damageReason-${boatId}`);
    const otherReasonContainer = document.getElementById(`otherDamageReasonContainer-${boatId}`);

    if (!depositAction || !reasonContainer || !reasonDropdown || !otherReasonContainer) {
        console.warn(`⚠️ One or more elements missing for Boat ID ${boatId}`);
        return;
    }

    console.log(`🔄 Updating Damage Reason Dropdown for Boat ID: ${boatId}, Action: ${depositAction.value}`);

    if (depositAction.value === "false") {
        reasonContainer.style.display = "block";
        reasonDropdown.addEventListener("change", () => this.toggleOtherReason(boatId));
    } else {
        reasonContainer.style.display = "none";
        otherReasonContainer.style.display = "none";
    }
};

OwnerApp.prototype.removeBoat = async function (boatId) {
    await this.app.waitForContractInit();
    this.app.showLoadingModal("loading", "Removing boat listing...");

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const tx = await contractWithSigner.removeBoat(boatId);
        await tx.wait();

        this.app.showLoadingModal("success", "Boat removed successfully!");

        document.getElementById("loadingCloseButton").addEventListener("click", function () {
            ownerApp.removeBoatFromUI(boatId);
        }, { once: true });

        this.updateDashboardStats();

    } catch (error) {
        console.error("❌ Error removing boat:", error);
        this.app.showLoadingModal("error", "Removal failed.");
    }
};

OwnerApp.prototype.removeBoatFromUI = function (boatId) {
    const boatElement = document.querySelector(`[data-boat-id="${boatId}"]`);
    if (!boatElement) {
        console.warn(`⚠️ Boat element with ID '${boatId}' not found!`);
        return;
    }

    boatElement.remove(); 
    console.log(`✅ Boat with ID '${boatId}' removed from UI.`);
};

OwnerApp.prototype.toggleBoatStatus = async function (boatId, setUnavailable) {
    await this.app.waitForContractInit();
    this.app.showLoadingModal("loading", "Updating boat status...");

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const tx = await contractWithSigner.updateBoatStatus(boatId, setUnavailable);
        await tx.wait();

        this.app.showLoadingModal("success", `Boat status updated to ${setUnavailable ? "Unavailable" : "Available"}!`);

        document.getElementById("loadingCloseButton").addEventListener("click", function () {
            ownerApp.updateBoatStatusUI(boatId, setUnavailable);
        }, { once: true });

        this.updateDashboardStats();

    } catch (error) {
        console.error("❌ Error updating boat status:", error);
        this.app.showLoadingModal("error", "Failed to update boat status.");
    }
};

OwnerApp.prototype.updateBoatStatusUI = function (boatId, setUnavailable) {
    const boatElement = document.querySelector(`[data-boat-id="${boatId}"]`);
    if (!boatElement) {
        console.warn(`⚠️ Boat element with ID '${boatId}' not found!`);
        return;
    }

    const statusText = boatElement.querySelector(".boat-status span");
    if (statusText) {
        statusText.classList.remove("bg-success", "bg-secondary");
        statusText.classList.add(setUnavailable ? "bg-secondary" : "bg-success");
        statusText.innerText = setUnavailable ? "Unavailable" : "Available";
    }

    const toggleButton = boatElement.querySelector(".toggle-status-btn");
    if (toggleButton) {
        toggleButton.innerText = setUnavailable ? "Set to Available" : "Set to Unavailable";
        toggleButton.classList.remove("btn-warning", "btn-success");
        toggleButton.classList.add(setUnavailable ? "btn-success" : "btn-warning");
        toggleButton.setAttribute("onclick", `ownerApp.toggleBoatStatus(${boatId}, ${!setUnavailable})`);
    }
};

OwnerApp.prototype.loadOwnerStats = async function () {
    await this.app.waitForContractInit();

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        const boatCount = await contractWithSigner.boatCount();
        let rentedBoats = 0;
        let availableBoats = 0;

        for (let i = 1; i <= boatCount.toNumber(); i++) {
            const boat = await contractWithSigner.getBoat(i);
            if (boat[7] === 1) rentedBoats++;
            if (boat[7] === 0) availableBoats++;
        }

        const totalBoatsElement = document.getElementById("totalBoats");
        const rentedBoatsElement = document.getElementById("rentedBoats");
        const availableBoatsElement = document.getElementById("availableBoats");

        if (totalBoatsElement) totalBoatsElement.innerText = boatCount.toNumber();
        if (rentedBoatsElement) rentedBoatsElement.innerText = rentedBoats;
        if (availableBoatsElement) availableBoatsElement.innerText = availableBoats;

    } catch (error) {
        console.error("❌ Error fetching owner stats:", error);
    }
};

OwnerApp.prototype.updateDashboardStats = async function () {
    await this.app.waitForContractInit();
    
    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        
        const boatCount = await contractWithSigner.boatCount();
        let availableBoats = 0;
        let rentedBoats = 0;

        for (let i = 1; i <= boatCount.toNumber(); i++) {
            const boat = await contractWithSigner.getBoat(i);
            if (!boat) continue;

            const boatStatus = boat[7];

            if (boatStatus === 0) availableBoats++;
            if (boatStatus === 1) rentedBoats++;
        }

        document.getElementById("totalBoats").innerText = boatCount.toNumber();
        document.getElementById("availableBoats").innerText = availableBoats;
        document.getElementById("rentedBoats").innerText = rentedBoats;

        console.log("📊 Dashboard stats updated!");

    } catch (error) {
        console.error("❌ Error updating dashboard stats:", error);
    }
};

OwnerApp.prototype.loadOwnerBoats = async function () {
    await this.app.waitForContractInit();
    const ownerBoatListings = document.getElementById("ownerBoatListings");
    ownerBoatListings.innerHTML = "<p>Loading boats...</p>";

    try {
        const contractWithSigner = this.app.contract.connect(this.app.web3Provider.getSigner());
        let boatCount = await contractWithSigner.boatCount();

        if (boatCount.toNumber() === 0) {
            ownerBoatListings.innerHTML = "<p>No boats listed.</p>";
            return;
        }

        ownerBoatListings.innerHTML = "<div class='row g-4'></div>";
        const boatRow = ownerBoatListings.querySelector(".row");

        for (let i = 1; i <= boatCount.toNumber(); i++) {
            const boat = await contractWithSigner.getBoat(i);
            if (!boat || boat[2] === "0x0000000000000000000000000000000000000000") {
                console.warn(`⚠️ Boat ${i} does not exist or was removed, skipping...`);
                continue;
            }

            const boatCard = this.createBoatCard(boat);
            boatRow.appendChild(boatCard);

            const depositAction = document.getElementById(`depositAction-${boat[0]}`);
            if (depositAction) {
                depositAction.addEventListener("change", () => this.showDamageReasonDropdown(boat[0]));
            }
        }
    } catch (error) {
        console.error("❌ Error fetching owner boats:", error);
    }
};

OwnerApp.prototype.createBoatCard = function (boat) {
    const statusMap = ["Available", "Rented", "Unavailable"];
    const statusColors = ["success", "warning", "secondary"];
    const boatStatus = statusMap[boat[7]];
    const statusColor = statusColors[boat[7]];
    const rentalEndTimestamp = boat[9];
    const boatImageUrl = `https://ipfs.io/ipfs/${boat[10]}`;

    const pricePerSecond = ethers.BigNumber.isBigNumber(boat[5]) 
        ? ethers.utils.formatEther(boat[5].toString()) 
        : ethers.utils.formatEther(boat[5]);

    const depositAmount = ethers.BigNumber.isBigNumber(boat[6]) 
        ? ethers.utils.formatEther(boat[6].toString()) 
        : ethers.utils.formatEther(boat[6]);

    const boatId = boat[0];
    const currentTime = Math.floor(Date.now() / 1000);
    const rentalDuration = rentalEndTimestamp > currentTime ? rentalEndTimestamp - currentTime : 0;
    const rentalAmount = ethers.utils.formatEther(
        ethers.BigNumber.from(boat[5]).mul(rentalDuration).toString()
    );

    let rentalInfo = "";
    let collectButton = "";

    if (boatStatus === "Rented") {
        const rentalExpired = currentTime >= rentalEndTimestamp;

        rentalInfo = `
            <p class="fw-bold text-dark mb-0">Rental Ends:</p>
            <p id="rental-status-${boatId}" class="fw-bold text-dark">
                ${new Date(rentalEndTimestamp * 1000).toLocaleString()} 
                ${rentalExpired ? '<span class="text-danger fw-bold">(Expired)</span>' : '<span class="text-success fw-bold">(Active)</span>'}
            </p>
        `;

        if (rentalExpired) {
            collectButton = `
                <div id="rentalControls-${boatId}" style="display: block;">
                    <select id="depositAction-${boatId}" class="form-select mb-2">
                        <option value="true">Refund Deposit</option>
                        <option value="false">Keep Deposit</option>
                    </select>

                    <div id="damageReasonContainer-${boatId}" style="display: none;">
                        <label for="damageReason-${boatId}" class="form-label">Select Reason:</label>
                        <select id="damageReason-${boatId}" class="form-select" onchange="ownerApp.toggleOtherReason(${boatId})">
                            <option value="Late return">Late return</option>
                            <option value="Boat damage">Boat damage</option>
                            <option value="Equipment missing">Equipment missing</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div id="otherDamageReasonContainer-${boatId}" style="display: none;">
                        <label for="otherDamageReason-${boatId}" class="form-label">Specify Reason:</label>
                        <input type="text" id="otherDamageReason-${boatId}" class="form-control" placeholder="Enter reason">
                    </div>

                    <button class="btn btn-primary w-100 mt-3" id="finalizeRentalButton-${boatId}" onclick="ownerApp.finalizeRental(${boatId})">
                        Collect Rental Fees
                    </button>
                </div>
            `;
        }
    }

    let actionButtons = "";
    if (boatStatus === "Available") {
        actionButtons = `
            <button class="btn btn-warning w-100 mb-2 toggle-status-btn" onclick="ownerApp.toggleBoatStatus(${boatId}, true)">Set to Unavailable</button>
            <button class="btn btn-danger w-100" onclick="ownerApp.removeBoat(${boatId})">Remove Listing</button>
        `;
    } else if (boatStatus === "Unavailable") {
        actionButtons = `
            <button class="btn btn-success w-100 mb-2 toggle-status-btn" onclick="ownerApp.toggleBoatStatus(${boatId}, false)">Set to Available</button>
            <button class="btn btn-danger w-100" onclick="ownerApp.removeBoat(${boatId})">Remove Boat</button>
        `;
    }

    const boatCard = document.createElement("div");
    boatCard.classList.add("col-lg-4", "col-md-6", "col-sm-12");
    boatCard.setAttribute("data-boat-id", boatId);

    boatCard.innerHTML = `
        <div class="card boat-card shadow-lg h-100 d-flex flex-column">
            <img src="${boatImageUrl}" class="card-img-top boat-image"
                alt="Boat Image"
                onerror="this.onerror=null; this.src='fallback-image.jpg';">
            <div class="card-body text-center d-flex flex-column justify-content-between">
                <h5 class="card-title">${boat[3]}</h5>
                <p class="card-text boat-description">${boat[4]}</p>
                <p><strong>Price:</strong> ${pricePerSecond} ETH/Sec</p>
                <p><strong>Deposit:</strong> ${depositAmount} ETH</p>
                <p class="boat-status"><span class="badge bg-${statusColor}">${boatStatus}</span></p>
                ${rentalInfo}
                <div class="d-grid gap-2">${collectButton}</div>    
                <div class="d-grid gap-2">${actionButtons}</div>
            </div>
        </div>
    `;

    return boatCard;
};


window.addEventListener("DOMContentLoaded", async () => {
    await boatRentalApp.getAccounts();
    ownerApp = new OwnerApp();
    ownerApp.init();
});