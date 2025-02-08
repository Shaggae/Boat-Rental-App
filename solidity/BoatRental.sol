// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract BoatRental {
    enum BoatStatus { Available, Rented, Unavailable }

    struct Boat {
        string ownerName;
        address payable owner;
        string boatName;
        string description;
        uint256 rentalPricePerSecond;
        uint256 depositAmount;
        string imageIPFS;
        BoatStatus status;
        address rentedBy;
        uint32 rentalEndTime;
    }

    mapping(uint256 => Boat) public boats;
    mapping(uint256 => uint256) private rentalEscrow;
    mapping(uint256 => uint256) private depositEscrow; 

    uint256 public boatCount;

    event BoatRegistered(uint256 boatId, string boatName, address owner);
    event BoatRented(uint256 boatId, address renter, uint256 rentalFee, uint256 deposit, uint256 rentalEndTime);
    event RentalFinalized(uint256 boatId, address owner, uint256 rentalFee, uint256 deposit, bool refunded);
    event BoatRemoved(uint256 boatId, address owner);
    event BoatRelisted(uint256 boatId, address owner);

    function registerBoat(
        string memory _ownerName,
        address payable _owner,
        string memory _boatName,
        string memory _description,
        uint256 _rentalPricePerSecond,
        uint256 _depositAmount,
        string memory _imageIPFS
    ) public {
        require(_rentalPricePerSecond > 0, "Rental price must be greater than zero");
        require(_depositAmount > 0, "Deposit amount must be greater than zero");

        boatCount++;
        boats[boatCount] = Boat({
            ownerName: _ownerName,
            owner: _owner,
            boatName: _boatName,
            description: _description,
            rentalPricePerSecond: _rentalPricePerSecond,
            depositAmount: _depositAmount,
            imageIPFS: _imageIPFS,
            status: BoatStatus.Available,
            rentedBy: address(0),
            rentalEndTime: 0
        });

        emit BoatRegistered(boatCount, _boatName, _owner);
    }

    function rentBoat(uint256 _boatId, uint32 _rentalDuration) public payable {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID");
        Boat storage boat = boats[_boatId];

        require(boat.status == BoatStatus.Available, "Boat is already rented or unavailable");
        require(_rentalDuration > 0, "Rental duration must be greater than zero");

        uint256 totalRentalFee = boat.rentalPricePerSecond * _rentalDuration;
        uint256 totalAmountRequired = totalRentalFee + boat.depositAmount;

        require(msg.value >= totalAmountRequired, "Insufficient funds for rental and deposit");

        boat.status = BoatStatus.Rented;
        boat.rentedBy = msg.sender;
        boat.rentalEndTime = uint32(block.timestamp + _rentalDuration);

        rentalEscrow[_boatId] = totalRentalFee;
        depositEscrow[_boatId] = boat.depositAmount;

        emit BoatRented(_boatId, msg.sender, totalRentalFee, boat.depositAmount, boat.rentalEndTime);
    }

    function getBoat(uint256 _boatId) public view returns (
        uint256, string memory, address, string memory, string memory, uint256, uint256, uint8, address, uint256, string memory
    ) {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID: Boat does not exist.");
    
        Boat memory boat = boats[_boatId];
        require(boat.owner != address(0), "Boat does not exist.");

        return (
            _boatId, boat.ownerName, boat.owner, boat.boatName, boat.description,
            boat.rentalPricePerSecond, boat.depositAmount, uint8(boat.status),
            boat.rentedBy, boat.rentalEndTime, boat.imageIPFS
        );
    }

    function updateBoatStatus(uint256 _boatId, bool setUnavailable) public {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID");
        Boat storage boat = boats[_boatId];

        require(msg.sender == boat.owner, "Only the boat owner can update the status");
        require(boat.status == BoatStatus.Available || boat.status == BoatStatus.Unavailable, "Cannot change status of a rented boat");

        boat.status = setUnavailable ? BoatStatus.Unavailable : BoatStatus.Available;

        emit BoatRelisted(_boatId, boat.owner);
    }

    function removeBoat(uint256 _boatId) public {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID");
        Boat storage boat = boats[_boatId];

        require(msg.sender == boat.owner, "Only the owner can remove the boat");
        require(boat.status != BoatStatus.Rented, "Cannot remove a boat that is rented");

        if (_boatId != boatCount) {
            boats[_boatId] = boats[boatCount];
        }

        delete boats[boatCount];
        boatCount--;

        emit BoatRemoved(_boatId, msg.sender);
    }

    function relistBoat(uint256 _boatId) public {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID");
        Boat storage boat = boats[_boatId];

        require(msg.sender == boat.owner, "Only the owner can relist the boat");
        require(boat.status == BoatStatus.Unavailable, "Boat must be unavailable to relist");

        boat.status = BoatStatus.Available;

        emit BoatRelisted(_boatId, boat.owner);
    }

    function finalizeRental(uint256 _boatId, bool refundDeposit) public {
        require(_boatId > 0 && _boatId <= boatCount, "Invalid boat ID");
        Boat storage boat = boats[_boatId];
        require(msg.sender == boat.owner, "Only the boat owner can finalize the rental");
        require(boat.rentalEndTime > 0, "Boat is not currently rented");
        require(block.timestamp >= boat.rentalEndTime, "Rental period has not ended yet");

        require(rentalEscrow[_boatId] > 0, "No rental fee available for release");
        uint256 rentalAmount = rentalEscrow[_boatId];
        rentalEscrow[_boatId] = 0;
        boat.owner.transfer(rentalAmount);
    
        uint256 depositAmount = depositEscrow[_boatId];
        depositEscrow[_boatId] = 0;

        if (refundDeposit) {
            payable(boat.rentedBy).transfer(depositAmount);
        } else {
            boat.owner.transfer(depositAmount);
        }

        boat.status = BoatStatus.Available;
        boat.rentedBy = address(0);
        boat.rentalEndTime = 0;

        emit RentalFinalized(_boatId, boat.owner, rentalAmount, depositAmount, refundDeposit);
    }
}
