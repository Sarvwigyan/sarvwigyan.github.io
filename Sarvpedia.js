const data = [
    { title: 'Elements', link: 'Elements.html' },
    { title: 'Argon Sarvpedia', link: 'Argon_sarvpedia.html' },
    // Add more items here
];
function Expsarvwigyan(){
    window.open('index.html', '_blank')
}
function filterSuggestions() {
    const query = document.getElementById('search-bar').value.toLowerCase();
    const filteredData = data.filter(item => item.title.toLowerCase().includes(query));

    const suggestionsList = document.getElementById('suggestions-list');
    suggestionsList.innerHTML = '';  // Clear previous suggestions

    if (query.trim().length > 0) {
        suggestionsList.style.display = 'block';  // Show suggestions while typing
    } else {
        suggestionsList.style.display = 'none';   // Hide suggestions when nothing typed
    }

    filteredData.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('suggestion-item');

        // Create a button instead of a link
        const button = document.createElement('button');
        button.classList.add('suggestion-button');
        button.innerHTML = item.title;

        // Add a click event listener to the button
        button.onclick = function() {
            window.open(item.link, '_blank');  // Open the link in a new window/tab
        };

        div.appendChild(button);
        suggestionsList.appendChild(div);
    });
}

// Close the suggestions list and clear the search bar if clicked outside
document.addEventListener('click', function(event) {
    const suggestionsList = document.getElementById('suggestions-list');
    const searchBar = document.getElementById('search-bar');

    // If the click is outside the search bar or the suggestions list, hide the list and clear the search bar
    if (!searchBar.contains(event.target) && !suggestionsList.contains(event.target)) {
        suggestionsList.style.display = 'none';
        searchBar.value = '';  // Clear the search bar text
    }
});