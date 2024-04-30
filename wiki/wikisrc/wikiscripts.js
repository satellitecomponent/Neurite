document.addEventListener("DOMContentLoaded", function () {
    const links = document.querySelectorAll('.sidebar a.load');
    const mainContent = document.getElementById('main-content');

    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default link behavior

            if (this.classList.contains('iframe')) {
                // Clear the existing content and adjust styling for iframe
                mainContent.innerHTML = '';
                mainContent.style.overflowY = 'hidden'; // Disable scrolling in the container
                mainContent.style.padding = '';

                // Set up and use the iframe
                const iframe = document.createElement('iframe');
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.frameBorder = "0";
                iframe.src = this.href;

                mainContent.appendChild(iframe);
            } else if (this.classList.contains('direct')) {
                // Enable scrolling for direct content loads
                mainContent.style.overflowY = 'auto';
                mainContent.style.padding = '20px';

                // Fetch and load HTML directly
                fetch(this.href)
                    .then(response => response.text())
                    .then(html => {
                        mainContent.innerHTML = html;
                    })
                    .catch(error => {
                        console.error('Error loading the page:', error);
                        mainContent.innerHTML = '<p>Error loading content.</p>';
                    });
            }
        });
    });
});