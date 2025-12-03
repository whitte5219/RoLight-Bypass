document.addEventListener('DOMContentLoaded', () => {
  const randomId = () => {
    let id = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 15; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };
  document.getElementById('bypass-id').textContent = randomId();
  document.getElementById('client-id').textContent = Math.floor(Math.random() * 5) + 1;
});
