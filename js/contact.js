document.getElementById("contactForm").addEventListener("submit", function(event) {
    event.preventDefault();

    let formData = new FormData(this);

    fetch("https://formsubmit.co/t.umathorn@gmail.com", {
        method: "POST",
        body: formData
    })
    .then(response => {
        if (response.ok) {
            document.getElementById("contactForm").classList.add("d-none");
            document.getElementById("confirmationMessage").classList.remove("d-none");

            document.getElementById("contactForm").reset();
        } else {
            alert("Something went wrong. Please try again.");
        }
    })
    .catch(error => console.error("Error:", error));
});

document.getElementById("backButton").addEventListener("click", function() {
    document.getElementById("confirmationMessage").classList.add("d-none");
    document.getElementById("contactForm").classList.remove("d-none");
});