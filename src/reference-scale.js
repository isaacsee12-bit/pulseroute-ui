const DESIGN_WIDTH = 1672;
const DESIGN_HEIGHT = 941;

function fitReferenceCanvas() {
  const shell = document.querySelector('.page-shell');
  if (!shell) return;
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  shell.style.transform = `scale(${scale})`;
  document.body.style.width = `${DESIGN_WIDTH * scale}px`;
  document.body.style.height = `${DESIGN_HEIGHT * scale}px`;
}

requestAnimationFrame(fitReferenceCanvas);
window.addEventListener('resize', fitReferenceCanvas, { passive: true });
