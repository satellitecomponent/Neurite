
// Function for custom slider background
function setSliderBackground(slider) {
    const min = slider.min ? parseFloat(slider.min) : 0;
    const max = slider.max ? parseFloat(slider.max) : 100;
    const value = slider.value ? parseFloat(slider.value) : 0;
    const percentage = (value - min) / (max - min) * 100;
    slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #18181c ${percentage}%, #18181c 100%)`;
}

document.querySelectorAll('input[type=range]:not(#customModal input[type=range])').forEach(function (slider) {
    setSliderBackground(slider);
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});