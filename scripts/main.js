/* ============================================================
   HEXON BETA — boot
   ============================================================ */
"use strict";

document.addEventListener("DOMContentLoaded", init);

/* Modal show/hide helpers. We use both .show (legacy) and .active
   (animation hook in effects.css) so old CSS keeps working while
   the new entrance animations also fire. */
function openModal(sel){
  const m = (typeof sel === "string") ? document.querySelector(sel) : sel;
  if(!m) return;
  m.classList.add("show", "active");
  if(typeof sfx !== "undefined") sfx.modalOpen();
}
function closeModal(sel){
  const m = (typeof sel === "string") ? document.querySelector(sel) : sel;
  if(!m) return;
  m.classList.remove("show", "active");
  if(typeof sfx !== "undefined") sfx.modalClose();
}

/* Close any open modal with Escape — accessibility win. */
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape"){
    document.querySelectorAll(".modal-back.show, .modal-back.active").forEach(m => {
      m.classList.remove("show", "active");
    });
  }
});

/* Unlock the audio context on the very first user gesture so future
   sound calls actually play. Chrome and Safari refuse to start
   audio until then; we listen once and self-detach. */
function _firstAudioUnlock(){
  if(typeof resumeAudio === "function") resumeAudio();
  window.removeEventListener("pointerdown", _firstAudioUnlock, true);
  window.removeEventListener("keydown",     _firstAudioUnlock, true);
  window.removeEventListener("touchstart",  _firstAudioUnlock, true);
}
window.addEventListener("pointerdown", _firstAudioUnlock, true);
window.addEventListener("keydown",     _firstAudioUnlock, true);
window.addEventListener("touchstart",  _firstAudioUnlock, true);
