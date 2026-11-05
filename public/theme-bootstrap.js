(() => {
  let preference = 'system'
  try {
    const saved = localStorage.getItem('postmission:theme-preference')
    if (saved === 'light' || saved === 'dark') preference = saved
  } catch { /* Private browsing may block storage. */ }
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#243447' : '#f4f0e8')
})()
