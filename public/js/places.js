const i=document.createElement("input");i.placeholder="Search places (e.g. Questura, Poste, University)…";i.style.cssText="max-width:420px;margin:10px 0 16px";$("#places h1").after(i);
i.oninput=()=>{const q=i.value.toLowerCase();document.querySelectorAll("#places .card").forEach(c=>c.hidden=!c.textContent.toLowerCase().includes(q))};
