export function dismissAppLaunch() {
  const launch = document.getElementById('app-launch')
  if (!launch || launch.classList.contains('app-launch-leaving')) return
  launch.classList.add('app-launch-leaving')
  window.setTimeout(() => launch.remove(), 180)
}
