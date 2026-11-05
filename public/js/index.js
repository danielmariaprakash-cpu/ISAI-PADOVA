let n=6;const cd=document.getElementById("cd"),t=setInterval(()=>{n--;if(cd)cd.textContent=n;if(n<=0){clearInterval(t);location.href="/home"}},1000);
