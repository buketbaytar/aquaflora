export function DivingMap() {
    return `
    <section class="diving-map-section container fade-in-up">
      <h2 class="section-title text-center">Popüler <span class="highlight">Dalış Noktaları</span></h2>
      <p class="section-desc text-center">Türkiye'nin en güzel su altı hazinelerini keşfedin.</p>
      
      <div class="map-container glass-panel">
        <!-- Interactive Map Placeholder -->
        <div class="interactive-map">
           <div class="map-point" style="top: 40%; left: 20%;" data-loc="Çanakkale - Batıklar">📍</div>
           <div class="map-point" style="top: 60%; left: 30%;" data-loc="Ayvalık - Mercan Resifleri">📍</div>
           <div class="map-point" style="top: 75%; left: 35%;" data-loc="Bodrum - Resifler">📍</div>
           <div class="map-point" style="top: 80%; left: 60%;" data-loc="Kaş - Uçak Batığı">📍</div>
           
           <div class="map-tooltip glass-panel hidden">
             <h4 id="map-tooltip-title">Location</h4>
             <p>Derinlik: <span id="map-tooltip-depth">0m</span></p>
           </div>
           
           <img src="https://upload.wikimedia.org/wikipedia/commons/2/22/Turkey_location_map.svg" alt="Turkey Map" class="turkey-map">
        </div>
      </div>
    </section>
  `;
}

export function setupMapInteractions() {
    const points = document.querySelectorAll('.map-point');
    const tooltip = document.querySelector('.map-tooltip');
    const title = document.getElementById('map-tooltip-title');
    const depth = document.getElementById('map-tooltip-depth');

    points.forEach(point => {
        point.addEventListener('mouseenter', (e) => {
            const loc = e.target.dataset.loc;
            title.textContent = loc;
            depth.textContent = Math.floor(Math.random() * 30 + 10) + 'm';

            tooltip.style.left = e.target.style.left;
            tooltip.style.top = (parseInt(e.target.style.top) - 10) + '%';
            tooltip.classList.remove('hidden');
        });

        point.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    });
}
