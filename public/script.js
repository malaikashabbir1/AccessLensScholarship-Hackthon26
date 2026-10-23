
document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  const yearElement = document.getElementById("currentYear");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Mobile navigation
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
      });
    });
  }

  // Scholarship pathway carousel
  const track = document.getElementById("carouselTrack");
  const viewport = document.getElementById("carouselViewport");
  const prevButton = document.getElementById("carouselPrev");
  const nextButton = document.getElementById("carouselNext");
  const pagination = document.getElementById("carouselPagination");

  if (!track || !viewport || !prevButton || !nextButton || !pagination) {
    return;
  }

  const cards = Array.from(track.querySelectorAll(".pathway-card"));

  if (cards.length === 0) {
    return;
  }

  let currentIndex = 0;
  let maxIndex = 0;

  function getVisibleCards() {
    if (window.innerWidth <= 520) return 1;
    if (window.innerWidth <= 800) return 2;
    return 3;
  }

  function buildPagination() {
    pagination.innerHTML = "";

    for (let i = 0; i <= maxIndex; i++) {
      const dot = document.createElement("button");

      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `Show pathway position ${i + 1}`);

      dot.addEventListener("click", () => {
        currentIndex = i;
        updateCarousel();
      });

      pagination.appendChild(dot);
    }
  }

  function updateCarousel() {
    const visibleCards = getVisibleCards();
    maxIndex = Math.max(0, cards.length - visibleCards);

    currentIndex = Math.min(currentIndex, maxIndex);

    const cardWidth = cards[0].getBoundingClientRect().width;
    const trackStyles = window.getComputedStyle(track);
    const gap = parseFloat(trackStyles.columnGap) || 0;
    const offset = currentIndex * (cardWidth + gap);

    track.style.transform = `translateX(-${offset}px)`;

    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === maxIndex;

    const dots = pagination.querySelectorAll(".carousel-dot");

    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === currentIndex);

      if (index === currentIndex) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  }

  prevButton.addEventListener("click", () => {
    currentIndex = Math.max(0, currentIndex - 1);
    updateCarousel();
  });

  nextButton.addEventListener("click", () => {
    currentIndex = Math.min(maxIndex, currentIndex + 1);
    updateCarousel();
  });

  let resizeFrame;

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);

    resizeFrame = requestAnimationFrame(() => {
      const previousMaxIndex = maxIndex;
      maxIndex = Math.max(0, cards.length - getVisibleCards());

      if (previousMaxIndex !== maxIndex) {
        buildPagination();
      }

      updateCarousel();
    });
  });

  buildPagination();
  updateCarousel();
});
