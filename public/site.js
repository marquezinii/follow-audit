const button = document.querySelector('#copy');
const feedback = document.querySelector('#feedback');

button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const response = await fetch('dist.js', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const script = await response.text();
    if (script.length < 500) throw new Error('incomplete bundle');
    await navigator.clipboard.writeText(script);
    feedback.textContent = 'Script copied. Open the Console on Instagram and paste it there.';
  } catch {
    feedback.textContent = 'Automatic copy failed. Download dist.js from GitHub instead.';
  } finally {
    button.disabled = false;
  }
});
