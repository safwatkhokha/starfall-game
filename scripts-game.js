const socket = io('https://slender-shore-floss.glitch.me/');

let users = {};
let bets = [];
let currentUser = null;
let betInterval = null;
let currentBet = null;
let multiplier = 1.00;
let crashPoint = null;
let currentTimer = null;
let redAppeared = false;
let isSoundMuted = false;
let animationLine = null;
let lineGlow = 0.3;

// Howler.js
let explosionSound, clickSound, winSound, loseSound, silentSound;
let soundsLoaded = false;

// إضافة متغيرات جديدة لتخزين تفضيلات المستخدم
let userPreferences = {
    theme: 'light', // الوضع الافتراضي: فاتح
    notifications: {
        comments: true,
        follows: true
    },
    profileVisibility: 'public' // عام، للأصدقاء فقط، خاص
};


function initializeSounds() {
    try {
        explosionSound = new Howl({
            src: ['sounds/explosion.mp3'],
            onload: function() {
                console.log('explosion.mp3 loaded successfully');
                checkIfAllSoundsLoaded();
            },
            onloaderror: function(e, msg) {
                console.error('Failed to load explosion.mp3', msg);
            }
        });
        clickSound = new Howl({
            src: ['sounds/click.mp3'],
            onload: function() {
                console.log('click.mp3 loaded successfully');
                checkIfAllSoundsLoaded();
            },
            onloaderror: function(e, msg) {
                console.error('Failed to load click.mp3', msg);
            }
        });
        winSound = new Howl({
            src: ['sounds/win.mp3'],
            onload: function() {
                console.log('win.mp3 loaded successfully');
              checkIfAllSoundsLoaded();

            },
            onloaderror: function(e, msg) {
                console.error('Failed to load win.mp3', msg);
            }
        });
        loseSound = new Howl({
            src: ['sounds/lose.mp3'],
            onload: function() {
                console.log('lose.mp3 loaded successfully');
                checkIfAllSoundsLoaded();
            },
            onloaderror: function(e, msg) {                    console.error('Failed to load lose.mp3', msg);
            }
        });
       silentSound = new Howl({
            src: ['sounds/silence.mp3'],
            volume: 0,
           onload: function() {
             console.log('silence.mp3 loaded successfully');
             checkIfAllSoundsLoaded();
          },
          onloaderror: function(e, msg) {
            console.error('Failed to load silence.mp3', msg);
        }
      });

       console.log("Sounds initialization started.");

    } catch (error) {
        console.error("Error initializing sounds:", error);
    }
}


function checkIfAllSoundsLoaded() {
  if(explosionSound.state() === "loaded" &&
  clickSound.state() === "loaded" &&
  winSound.state() === "loaded" &&
  loseSound.state() === "loaded" &&
  silentSound.state() === "loaded"){
     soundsLoaded = true;
     console.log("All sounds loaded!");
  }
}


function unlockAudioContext() {
    if (silentSound) {
        silentSound.once('play', () => {
            console.log("AudioContext unlocked and sounds initialized.");
            document.body.removeEventListener('click', unlockAudioContext);
             setTimeout(() => {
            initializeSounds();
      },100);
        });
        silentSound.play();
    }
}

document.body.addEventListener('click', unlockAudioContext);
function sendUsersData() {
    socket.emit('usersData', users);
}

window.addEventListener('load', () => {
    // تحقق من وجود بيانات المستخدم المحفوظة في ملفات تعريف الارتباط
    const rememberMe = localStorage.getItem('rememberMe');
    if (rememberMe === 'true') {
        const email = localStorage.getItem('email');
        const password = localStorage.getItem('password');
        if (email && password) {
            login(email, password, true);
            return;
        }
    }
     gsap.registerPlugin(MotionPathPlugin);
    sendUsersData();
    // لم نعد نطلب الأرقام هنا، السيرفر سيرسلها تلقائيًا عند الاتصال
    // socket.emit('getReceiverNumbers');
      if ('serviceWorker' in navigator) {
       window.addEventListener('load', () => {
           setTimeout(() => {
              navigator.serviceWorker.register('/service-worker.js')
              .then(() => console.log('Service Worker registered'))
              .catch((err) => console.error('Service Worker registration failed:', err));
           }, 100);  // تأخير تسجيل الـ Service Worker لـ 100 مللي ثانية
        });
   }
    const profileTabs = document.querySelectorAll('.profile-tabs .tab-button');
     const profileContents = document.querySelectorAll('.profile-section .profile-tab');
     profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const contentId = tab.getAttribute('data-tab');

           profileTabs.forEach(t => t.classList.remove('active'));
           tab.classList.add('active');
          profileContents.forEach(content => {
               content.style.display = 'none'
         });
          document.getElementById(`profile${contentId.charAt(0).toUpperCase() + contentId.slice(1)}Tab`).style.display = 'block';
        });
    });
    const transactionTabs = document.querySelectorAll('.transaction-tabs .tab-button');
    const transactionContents = document.querySelectorAll('.transaction-container .transaction-content');

    transactionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const contentId = tab.getAttribute('data-content');

            transactionTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

             transactionContents.forEach(content => {
                 content.style.display = 'none'
             });
            document.querySelector(`.transaction-content[data-content='${contentId}']`).style.display = 'flex';
        });
    });
});


function addNewUser(username, email, password, phone) {
    if (!users[email]) {
        users[email] = {
            username: username,
            password: password,
            balance: 0,
            totalProfit: 0,
             registrationDate : Date.now(),
            phone: phone
        }; // تخزين كلمة المرور ورقم الهاتف
        console.log(`تم إضافة المستخدم ${username} بالبريد الإلكتروني ${email} ورقم الهاتف ${phone}.`);
        socket.emit('usersData', users);
        return true;
    } else {
        console.log(`المستخدم ${email} موجود بالفعل.`);
        return false;
    }
}

function signup() {
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const phone = document.getElementById('newUserPhone').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    // تحقق من اسم المستخدم
    if (!username) {
        alert("الرجاء إدخال اسم المستخدم.");
        return;
    }

    // تحقق من البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        alert("الرجاء إدخال البريد الإلكتروني.");
        return;
    } else if (!emailRegex.test(email)) {
        alert("الرجاء إدخال بريد إلكتروني صالح.");
        return;
    }

    // تحقق من رقم الهاتف (يمكن تبسيط التحقق هنا)
    const phoneRegex = /^\d+$/; // بسيط: يجب أن يكون رقمًا فقط
    if (!phone) {
        alert("الرجاء إدخال رقم الهاتف.");
        return;
    } else if (!phoneRegex.test(phone)) {
        alert("الرجاء إدخال رقم هاتف صالح (أرقام فقط).");
        return;
    }

    if (!password) {
        alert("الرجاء إدخال كلمة المرور.");
        return;
    } else if (password !== confirmPassword) {
        alert("كلمتا المرور غير متطابقتين.");
        return;
    }

    if (username && email && password && confirmPassword && password === confirmPassword && phone && emailRegex.test(email) && phoneRegex.test(phone)) {
        if (addNewUser(username, email, password, phone)) {
            alert(`تم إنشاء المستخدم ${username} بنجاح!`);
            showLoginForm();
            initParticles();
        } else {
            alert(`المستخدم ${email} موجود بالفعل.`);
        }
    } else {
        alert("الرجاء إدخال جميع البيانات بشكل صحيح.");
    }
}

function login(email, password, fromCookie = false) {
    if (!email) {
        email = document.getElementById('email').value.trim();
        password = document.getElementById('password').value.trim();
    }

    if (email && password && email.length > 0 && password.length > 0) {
        if (users[email] && users[email].password === password) {
            currentUser = email;
            // إظهار قسم اللعبة أولاً
            document.getElementById('gameSection').style.display = 'block';
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('profileSection').style.display = 'none';
            document.getElementById('gameOptionsSection').style.display = 'none';


            // ثم تحديث اسم المستخدم والرصيد
            document.getElementById('loggedInUser').textContent = users[email].username;
            document.getElementById('userBalance').textContent = users[email].balance.toFixed(2);
            // إذا كان المستخدم قد اختار "تذكرني"، احفظ بياناته في ملفات تعريف الارتباط // إذا كان المستخدم قد اختار "تذكرني"، احفظ بياناته في ملفات تعريف الارتباط
            if (!fromCookie && document.getElementById('rememberMe').checked) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('email', email);
                localStorage.setItem('password', password);

            } else {
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('email');
                localStorage.removeItem('password');

            }
            // تحديث التفضيلات عند تسجيل الدخول
            applyTheme(userPreferences.theme);

             showMessage("تم تسجيل الدخول بنجاح!", "success");
            socket.emit('usersData', users);
            socket.emit('getTransactions');
        } else {
            alert("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }
    } else {
        alert("الرجاء إدخال البريد الإلكتروني وكلمة المرور.");
    }
}
/**
 * دالة تسجيل الدخول الاجتماعي.
 *
 * @param {string} provider اسم مزود خدمة تسجيل الدخول الاجتماعي (google, facebook, الخ)
 */
function socialLogin(provider) {
    // هنا، يجب أن يكون لديك رمز للتعامل مع تسجيل الدخول الاجتماعي الفعلي.
    // يمكنك استخدام مكتبات مثل Firebase Authentication أو Auth0.
    // سأعرض مثالًا بسيطًا باستخدام تنبيه (alert) فقط.
    alert(`تم الضغط على تسجيل الدخول بواسطة ${provider}. يجب عليك إضافة الكود الفعلي هنا.`);
}

function setBetAmount(amount) {
    document.getElementById('betAmount').value = amount;
}

function changeBetAmount(change) {
    let betAmountInput = document.getElementById('betAmount');
    let currentBetAmount = parseInt(betAmountInput.value) || 0;
    let newBetAmount = Math.max(10, currentBetAmount + change); // لا يمكن أن يقل عن 10
    betAmountInput.value = newBetAmount;

}

function startBet() {
    if(soundsLoaded){
        if (clickSound && !isSoundMuted) {
            console.log("Playing click sound");
            clickSound.play();
        }
    }
    const betAmount = parseFloat(document.getElementById('betAmount').value);
    const user = users[currentUser];

    if (betAmount && betAmount >= 10 && betAmount <= 5000) {
        if (user.balance >= betAmount) {
            currentBet = betAmount;
            user.balance -= betAmount;
            document.getElementById('userBalance').textContent = user.balance.toFixed(2);
            document.getElementById('startBetButton').disabled = true;
            startMultiplier();
        } else {
             showMessage("رصيدك غير كافي لوضع هذا الرهان.", "error");
        }
    } else {
         showMessage("الرجاء إدخال قيمة رهان بين 10 و 5000.", "error");
    }
}

function startMultiplier() {
     const progressContainer = document.querySelector('.progress-container');
    const containerWidth = progressContainer.offsetWidth;
    const birdProgress = document.getElementById('birdProgress'); // Use the correct ID
    crashPoint = (Math.random() * 8 + 1.2).toFixed(2);
    if (crashPoint > 10) {
        crashPoint = 10.0;
    }
    multiplier = 1.00;
    let elapsedTime = 0;
    let maxTime = 60;
    redAppeared = false;

    let acceleration = 0.0001; // معدل التسارع الأولي
    let verticalOffset = 0; // إزاحة عمودية
    let verticalSpeed = 0.1; // سرعة التذبذب العمودي
    let rotationAngle = 5; // زاوية الدوران

    // Create the animation line if it doesn't exist
    if (!animationLine) {
            animationLine = document.createElement('div');
            animationLine.classList.add('animation-line');
            progressContainer.appendChild(animationLine);

           gsap.set(animationLine, {
            x:0,
               width :0,
           });
        }

    betInterval = setInterval(() => {
        let randomIncrease = Math.random() * 0.03 + 0.005;
        multiplier += randomIncrease * (crashPoint - multiplier) + acceleration;
        acceleration += 0.00001;

        let progress = (multiplier / crashPoint) * 100;
       let linePosition = (progress / 100) * (containerWidth);
            gsap.to(animationLine, {
                 duration: 0.1,
                x:0,
                 width:linePosition ,
            ease: "power1.inOut" ,
            });

        let randomChance = Math.random();
        let lossChance = Math.sin(randomChance * Math.PI);
        if (randomChance < lossChance) {
            document.getElementById('multiplierText').classList.remove('danger');
            document.getElementById('multiplierText').classList.add('loss');
            redAppeared = false;
        } else {
            document.getElementById('multiplierText').classList.remove('loss');
            document.getElementById('multiplierText').classList.add('danger');
            redAppeared = true;
        }
           lineGlow = 0.3;

        elapsedTime++;
        document.getElementById('multiplierText').textContent = `${multiplier.toFixed(2)}x`;

        // تغيير لون العداد تدريجياً
        let colorValue = Math.min(multiplier * 20, 255);
        let color = `rgb(${colorValue}, ${255 - colorValue}, 0)`;
        document.getElementById('multiplierText').style.color = color;

        if (multiplier >= crashPoint || elapsedTime >= maxTime) {
            clearInterval(betInterval);
            endBet("انفجار");
        }
    }, 100);
}
let notificationElement = null;
let isNotificationActive = false;

function endBet(reason) {
    const user = users[currentUser];
    const notificationArea = document.getElementById('notification-area');
    let message = '';
    let icon = '';
    let notificationClass = '';
    let profit = 0;
    let notificationImageSrc = ''; // متغير جديد لتخزين مسار الصورة

    if (reason === "انفجار" && !redAppeared) {
        icon = '<i class="fas fa-times-circle"></i>';
        message = `لقد خسرت ${currentBet.toFixed(2)} EGP`;
        notificationClass = 'lose-notification';
        notificationImageSrc = 'images/lose-icon.png'; // مثال لصورة الخسارة
        user.totalProfit -= currentBet;
         if(soundsLoaded){
            if (loseSound && !isSoundMuted) {
                console.log("Playing lose sound");
                loseSound.play();
           }
        }

    } else if (redAppeared) {
        icon = '<i class="fas fa-check-circle"></i>';
        profit = currentBet * multiplier;
        message = `ربحت ${profit.toFixed(2)} EGP`;
        notificationClass = 'win-notification';
        notificationImageSrc = 'images/win-icon.png'; // مثال لصورة الفوز

        user.balance += currentBet + profit;
        user.totalProfit += profit;
        showExplosion();
        if(soundsLoaded){
             if (explosionSound && !isSoundMuted) {
                console.log("Playing explosion sound");
                explosionSound.play();
            }
            if (winSound && !isSoundMuted) {
              console.log("Playing win sound");
              winSound.play();
            }
        }
          lineGlow = 1.8;
              gsap.to(animationLine, {
                     boxShadow: `0 0 15px rgba(255, 255, 255, ${lineGlow})`,
              });
    }
    // إذا لم يكن عنصر الإشعار موجودًا، قم بإنشائه
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.classList.add('notification');
        notificationArea.appendChild(notificationElement);
        gsap.set(notificationElement, {
            y: -20,
            opacity: 0
        });
    }
    if (isNotificationActive) return;
    isNotificationActive = true;

    notificationElement.className = `notification ${notificationClass}`;
    // إنشاء عنصر الصورة ديناميكيًا
    const notificationImage = document.createElement('img');
    notificationImage.src = notificationImageSrc;
    notificationImage.classList.add('notification-image'); // إضافة كلاس لتنسيق الصورة

    notificationElement.innerHTML = `${icon} ${message}`;
    notificationElement.prepend(notificationImage); // إضافة الصورة في بداية الإشعار


    gsap.to(notificationElement, {
        y: 0,
        opacity: 1,
        duration: 0.1,
        ease: 'power1.out'
    });
    const bet = {
        user: currentUser,
        multiplier: `${multiplier.toFixed(2)}x`,
        amount: currentBet,
        profit: redAppeared ? (currentBet * multiplier).toFixed(2) : "0.00"
    };
    bets.push(bet);

    document.getElementById('userBalance').textContent = user.balance.toFixed(2);
    resetBet();
    setTimeout(() => {
        gsap.to(notificationElement, {
            y: -40,
            opacity: 0,
            duration: 0.1,
            ease: 'power1.in',
            onComplete: () => {
                isNotificationActive = false;
                requestAnimationFrame(() => {
                    updateTable();
                  gsap.to(animationLine, {
                         boxShadow: `0 0 15px rgba(255, 255, 255, 0)`,
                      });
                });
            }
        });
    }, 800);
}

function showMessage(message, type = "success", imageSrc = '') { // إضافة imageSrc كمعامل اختياري
    let icon = '';
    if (type === "success") {
        icon = 'success';
        imageSrc = 'images/login-success.png'
    } else if (type === "error") {
        icon = 'error';
         imageSrc = 'images/input-error.png'
        } else if (type === "warning") {
            icon = 'warning';
        } else if (type === "info") {
            icon = 'info';
            imageSrc = 'images/deposit-info.png'
        }
    
        Swal.fire({
            icon: icon,
            title: message,
            imageUrl: imageSrc, // تعيين مسار الصورة هنا
            imageWidth: 60,      // يمكنك تعديل حجم الصورة حسب الحاجة
            imageHeight: 60,
            imageAlt: 'Notification Image',
            showConfirmButton: false,
            timer: 1500
        });
    }
    
    function updateTable() {
        const table = document.getElementById('betsTable');
        const newTableBody = document.createElement('tbody');
        bets.forEach(bet => {
            const row = newTableBody.insertRow();
            row.insertCell(0).textContent = bet.user;
            row.insertCell(1).textContent = bet.multiplier;
            row.insertCell(2).textContent = bet.amount.toFixed(2);
            row.insertCell(3).textContent = bet.profit;
        });
        table.innerHTML = `
              <tr>
                  <th>اسم المستخدم</th>
                  <th>المضاعفة</th>
                   <th>الرهان</th>
                   <th>الإرباح</th>
               </tr>`;
        table.appendChild(newTableBody);
    }
    
    function resetBet() {
        document.getElementById('betAmount').value = '10';
        document.getElementById('startBetButton').disabled = false;
    }
    
    function showExplosion() {
        const explosionImage = document.getElementById('explosionImage');
        if (explosionImage) {
            explosionImage.style.display = 'inline-block';
            setTimeout(() => {
                explosionImage.style.display = 'none';
            }, 500);
        }
    }
    
    
    
    function requestDeposit() {
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const senderPhone = document.getElementById('senderPhone').value.trim();
        const receiverSelect = document.getElementById('receiverNumbers');
        const receiverPhone = receiverSelect.value;
        const depositImage = document.getElementById('depositImage').files[0];
    
        if (amount && amount > 0 && senderPhone && receiverPhone && depositImage) {
            const reader = new FileReader();
            reader.onloadend = () => {
                socket.emit('requestTransaction', {
                    userId: currentUser,
                    type: 'deposit',
                    amount,
                    senderPhone,
                    receiverPhone,
                    depositImage: reader.result
                });
                 showMessage(`تم إرسال طلب إيداع بمبلغ ${amount} EGP.`, "info");
            };
            reader.readAsDataURL(depositImage);
    
        } else {
           showMessage("الرجاء إدخال مبلغ صحيح ورقم المرسل ورقم المستلم وإرفاق الصورة.", "error");
        }
    }
    
    function requestWithdrawal() {
        const amount = parseFloat(document.getElementById('withdrawalAmount').value);
        const withdrawalButton = document.getElementById('withdrawalButton');
        if (amount && amount > 0) {
            if (amount <= users[currentUser].balance) {
                withdrawalButton.disabled = true;
                showMessage("طلب السحب قيد المعالجة...", "info", 'images/withdrawal-pending.png');
    
                const user = users[currentUser];
                socket.emit('requestTransaction', {
                    userId: currentUser,
                    type: 'withdrawal',
                    amount,
                    userPhone: user.phone
                });
                document.getElementById('withdrawalAmount').value = '';
            } else {
                showMessage("رصيدك غير كافٍ لطلب هذا السحب.", "error", 'images/balance-error.png');
            }
        } else {
             showMessage("الرجاء إدخال مبلغ صحيح.", "error");
        }
    }
    
    
    socket.on('depositApproved', (data) => {
        if (users[data.userId]) {
            users[data.userId].balance += parseFloat(data.amount);
            if (currentUser === data.userId) {
                document.getElementById('userBalance').textContent = users[data.userId].balance.toFixed(2);
            }
    
        }
    });
    
    socket.on('withdrawalApproved', (data) => {
        if (users[data.userId]) {
            users[data.userId].balance -= parseFloat(data.amount);
            if (currentUser === data.userId) {
                document.getElementById('userBalance').textContent = users[data.userId].balance.toFixed(2);
            }
        }
        document.getElementById('withdrawalButton').disabled = false;
         showMessage("تمت الموافقة على السحب بنجاح.", "success", 'images/withdrawal-success.png');
    
    });
    // إضافة معالجة للرفض (إذا كان ذلك متاحًا في الخادم)
    socket.on('withdrawalRejected', (data) => {
        document.getElementById('withdrawalButton').disabled = false;
        showMessage("تم رفض طلب السحب: " + data.message, "error", 'images/withdrawal-error.png');
    });
    
    
    
    socket.on('receiverNumbers', (numbers) => {
        updateReceiverNumberInput(numbers);
    });
    
    function logout() {
        currentUser = null;
        clearInterval(betInterval);
        betInterval = null;
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('gameOptionsSection').style.display = 'none';
         showMessage("تم تسجيل الخروج بنجاح.", "success",'images/logout-success.png');
    }
    
    function showForgotPasswordForm() {
        document.getElementById('authTitle').textContent = "استعادة كلمة السر";
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'block';
    
    }
    
    function resetPasswordRequest() {
        const email = document.getElementById('forgotEmail').value.trim();
        if (email && users[email]) {
            socket.emit('resetPasswordRequest', {
                email: email
            });
            showMessage("تم إرسال رابط تعديل كلمة السر إلى بريدك الإلكتروني.", "info", 'images/reset-password-info.png');
            document.getElementById('forgotPasswordForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('authTitle').textContent = "تسجيل الدخول";
    
        } else {
             showMessage("البريد الإلكتروني غير مسجل لدينا.", "error", 'images/email-error.png');
        }
    
    }
    
    
    function showSignupForm() {
        document.getElementById('authTitle').textContent = "إنشاء حساب جديد";
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    }
    
    function showLoginForm() {
        document.getElementById('authTitle').textContent = "تسجيل الدخول";
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    }
    
    
    function toggleEdit(field) {
        const editDiv = document.getElementById(`edit${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (editDiv) {
            editDiv.style.display = editDiv.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    function updateProfile(field) {
        const newValueInput = document.getElementById(`editNew${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (newValueInput) {
            const newValue = newValueInput.value.trim();
            if (newValue) {
                const user = users[currentUser];
                if (field === 'username') {
                    user.username = newValue;
                    document.getElementById('profileUsername').textContent = newValue;
                    document.getElementById('loggedInUser').textContent = newValue;
                } else if (field === 'email') {
                    if (!users[newValue] || newValue === currentUser) {
                        const oldEmail = currentUser
                        users[newValue] = users[oldEmail]
                        delete users[oldEmail]
                        currentUser = newValue;
                        document.getElementById('profileEmail').textContent = newValue;
                        sendUsersData()
                    } else {
                        showMessage("هذا البريد الإلكتروني مسجل بالفعل.", "error", 'images/email-exists-error.png');
                        return
                    }
    
                } else if (field === 'phone') {
                    user.phone = newValue;
                    document.getElementById('profilePhone').textContent = newValue;
    
                }
                sendUsersData();
                toggleEdit(field);
                 showMessage("تم تحديث الملف الشخصي بنجاح.", "success", 'images/profile-update-success.png');
            } else {
               showMessage("الرجاء إدخال قيمة جديدة.", "error", 'images/input-error.png');
            }
        }
    }
    
     function showProfile() {
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameOptionsSection').style.display = 'none';
        // تحديث معلومات ملف المستخدم
        document.getElementById('profileUsername').textContent = users[currentUser].username;
        document.getElementById('profileEmail').textContent = currentUser;
        document.getElementById('profilePhone').textContent = users[currentUser].phone;
        document.getElementById('profileBalance').textContent = users[currentUser].balance.toFixed(2);
        document.getElementById('profileTotalProfit').textContent = users[currentUser].totalProfit.toFixed(2);
        document.getElementById('profileNetProfit').textContent = (users[currentUser].totalProfit-users[currentUser].balance).toFixed(2);
            const registrationDate = new Date(users[currentUser].registrationDate);
               document.getElementById('profileRegistrationDate').textContent = registrationDate.toLocaleDateString();
        // تعيين قيمة محدد الوضع
        document.getElementById('themeSelect').value = userPreferences.theme;
    
        document.getElementById('profileSection').style.display = 'block';
    }
    
    function showGame() {
        document.getElementById('profileSection').style.display = 'none';
        document.getElementById('gameOptionsSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
    }
    
    function showGameOptions() {
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('profileSection').style.display = 'none';
        document.getElementById('gameOptionsSection').style.display = 'block';
    }
    
    function changeTheme(theme) {
        // تحديث تفضيلات المستخدم
        updateUserPreferences({
            theme: theme
        });
    
        // تطبيق الوضع الجديد
        applyTheme(theme);
    }
     function changePassword() {
      const currentPassword = document.getElementById('currentPassword').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
       const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();
        if(currentPassword && newPassword && confirmNewPassword && newPassword === confirmNewPassword){
             if (users[currentUser] && users[currentUser].password === currentPassword) {
                users[currentUser].password = newPassword;
                  sendUsersData();
                   showMessage("تم تغيير كلمة المرور بنجاح.", "success", 'images/password-update-success.png');
                   document.getElementById('currentPassword').value = "";
                   document.getElementById('newPassword').value = "";
                  document.getElementById('confirmNewPassword').value = "";
              } else {
                    showMessage("كلمة المرور الحالية غير صحيحة", "error", 'images/password-error.png');
                }
        }else{
             showMessage("الرجاء إدخال كلمة مرور صحيحة.", "error", 'images/input-error.png');
        }
     }
    function applyTheme(theme) {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
    
        // تطبيق الوضع على الأقسام الأخرى (إذا لزم الأمر)
        const authSection = document.getElementById('authSection');
        const profileSection = document.getElementById('profileSection');
        const gameSection = document.getElementById('gameSection');
        const gameOptionsSection = document.getElementById('gameOptionsSection');
    
        authSection.className = `auth-section ${theme === 'dark' ? 'dark-theme' : ''}`;
        profileSection.className = `profile-section ${theme === 'dark' ? 'dark-theme' : ''}`;
        gameSection.className = `game-section ${theme === 'dark' ? 'dark-theme' : ''}`;
        gameOptionsSection.className = `game-options-section ${theme === 'dark' ? 'dark-theme' : ''}`;
    }
    
    
    function updateReceiverNumberInput(numbers) {
        console.log("Receiver numbers received (event-driven):", numbers); // للتحقق - اتركها
        const select = document.getElementById('receiverNumbers');    select.innerHTML = '';
        for (const number in numbers) {
            const option = document.createElement('option');
            option.value = number;
            option.textContent = `${number}  (${numbers[number]})`;
            select.appendChild(option);
        }
    }
    const toggleSoundButton = document.getElementById('toggleSound');
    toggleSoundButton.addEventListener('click', () => {
        isSoundMuted = !isSoundMuted;
        if (isSoundMuted) {
            toggleSoundButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
            if (silentSound) silentSound.play()
         } else {
             toggleSoundButton.innerHTML = '<i class="fas fa-volume-up"></i>';
             if (silentSound) silentSound.pause();
         }
     });
     function updateUserPreferences(newPrefs) {
         userPreferences = {
             ...userPreferences,
             ...newPrefs
         };
         console.log('User Preferences Updated:', userPreferences);
     }
     
     function shareGame() {
         // يمكنك هنا تخصيص النص الذي سيتم مشاركته
         const shareText = "العب لعبة StarFall الرائعة!";
         const shareUrl = window.location.href; // أو يمكنك وضع رابط محدد للعبة
         if (navigator.share) {
             navigator.share({
                 title: "StarFall Game",
                 text: shareText,
                 url: shareUrl
             }).then(() => console.log("تمت المشاركة بنجاح!"))
                 .catch((error) => console.error("حدث خطأ أثناء المشاركة:", error));
         } else {
             // في حالة عدم دعم واجهة برمجة التطبيقات للمشاركة، سيتم فتح نافذة منبثقة
             window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
             showMessage("الرجاء استخدام طرق المشاركة التي يوفرها جهازك.", "info", 'images/share-info.png');
         }
     }
     
     function initParticles() {
         particlesJS.load('particles-js', 'particles.json', function() {
            console.log('particles.js config loaded');
        });
     }
