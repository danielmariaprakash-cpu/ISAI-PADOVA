$("#fb").onclick=async()=>{const v=k=>$("#f_"+k).value.trim(),r={name:v("n"),surname:v("s"),dept:v("d"),dob:v("b"),address:v("a"),phone:v("p"),email:v("e"),hp:v("h")};
if(!r.name||!r.surname||!r.dept||!r.dob||!r.address||!r.phone)return $("#fe").textContent="Please fill all required fields.";
if(!/^\+?[0-9 ()-]{7,20}$/.test(r.phone))return $("#fe").textContent="Please enter a valid phone number.";
if(r.dob>new Date().toISOString().slice(0,10))return $("#fe").textContent="Date of birth cannot be in the future.";
if(!$("#f_c").checked)return $("#fe").textContent="Please accept the consent box.";
$("#fe").textContent="";$("#fb").disabled=true;try{const o=await API("enroll",r);$("#fw").hidden=true;$("#fo").hidden=false;if(o.updated)$("#fo").insertAdjacentHTML("afterbegin",'<p class="mut">We already had this phone number, so your details were updated.</p>')}catch(e){$("#fe").textContent=e.message;$("#fb").disabled=false}};
