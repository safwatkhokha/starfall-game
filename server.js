const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// تقديم الملفات الثابتة
app.use(cors());
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/', express.static(path.join(__dirname, 'game')));

// تخزين بيانات المستخدمين
let users = {};
let receiverNumbers = {
    '01012345678': 'فودافون',
    '01112345678': 'اورنج',
    '01212345678': 'اتصالات',
    '01512345678': 'we'
};

// تخزين طلبات الإيداع والسحب
let transactions = [];
let nextTransactionId = 1;

// تخزين رموز إعادة تعيين كلمة المرور
let passwordResetTokens = {};

// إعداد جلسات المستخدمين
app.use(session({
    secret: '93d82b7c5e7a1f4b0d6c9a8e4f2b1c5d',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// إعداد body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// مسار تسجيل الدخول للوحة التحكم
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/login.html'));
});

// معالجة بيانات تسجيل الدخول
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password') {
        req.session.loggedin = true;
        res.redirect('/admin');
    } else {
        res.send('Incorrect username or password!');
    }
});
 // تقديم صفحة اللعبة الرئيسية
app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'game/index.html'));
});
// تقديم صفحة تسجيل الدخول عند الوصول إلى /login (اختياري)
app.get('/login', (req, res) => {
     res.redirect('/admin/login'); // أو يمكنك تقديم ملف login.html مباشرةً
     //res.sendFile(path.join(__dirname, 'admin/login.html'));
 });


// مسار لوحة التحكم الرئيسية
app.get('/admin', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'admin/admin.html')); // تم التعديل هنا
    } else {
        res.redirect('/admin/login');
    }
});

// مسار تسجيل الخروج
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// مسار الموافقة على طلبات الإيداع والسحب
app.post('/approve-transaction', (req, res) => {
    if (req.session.loggedin) {
        const { transactionId, type } = req.body;
        const transactionIndex = transactions.findIndex(t => t.id === transactionId && t.status === 'pending');

        if (transactionIndex !== -1) {
            const transaction = transactions[transactionIndex];
            transaction.status = 'approved';
            const user = users[transaction.userId];

            if (type === 'deposit') {
                user.balance += parseFloat(transaction.amount);
                io.emit('depositApproved', { userId: transaction.userId, amount: transaction.amount });
                  io.emit('notification',`تمت الموافقة على إيداع بمبلغ ${transaction.amount} للمستخدم ${transaction.userId}`);
            } else if (type === 'withdrawal') {
                if (user.balance >= parseFloat(transaction.amount)) {
                    user.balance -= parseFloat(transaction.amount);
                    io.emit('withdrawalApproved', { userId: transaction.userId, amount: transaction.amount });
                    io.emit('notification',`تمت الموافقة على سحب بمبلغ ${transaction.amount} للمستخدم ${transaction.userId}`);
                } else {
                    transaction.status = 'rejected';
                    res.json({ success: false, message: 'رصيد المستخدم غير كافٍ.' });
                     io.emit('notification',`تم رفض طلب سحب بمبلغ ${transaction.amount} للمستخدم ${transaction.userId} بسبب عدم كفاية الرصيد.`);
                    return;
                }
            }

            transactions.splice(transactionIndex, 1);

             io.emit('transactionsUpdate', transactions);
             io.emit('getTransactions');

            res.json({ success: true, message: `تمت الموافقة على ${type === 'deposit' ? 'الإيداع' : 'السحب'} بنجاح` });
        } else {
            res.json({ success: false, message: 'الطلب غير موجود أو تمت الموافقة عليه مسبقًا' });
        }
    } else {
        res.status(401).json({ success: false, message: 'غير مصرح' });
    }
});

// دوال مساعدة لحساب إجمالي الإيداعات والسحوبات
function getTotalDeposits() {
    let total = 0;
    transactions.forEach(transaction => {
        if (transaction.type === 'deposit' && transaction.status === 'approved') {
            total += parseFloat(transaction.amount);
        }
    });
    return total;
}

function getTotalWithdrawals() {
    let total = 0;
    transactions.forEach(transaction => {
        if (transaction.type === 'withdrawal' && transaction.status === 'approved') {
            total += parseFloat(transaction.amount);
        }
    });
    return total;
}

// إعداد nodemailer لإرسال البريد الإلكتروني
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your_email@gmail.com',
        pass: 'your_email_password'
    }
});

// اتصال Socket.IO
io.on('connection', (socket) => {
    console.log('A user connected');

    // إرسال أرقام المستلمين إلى العميل فور الاتصال
    socket.emit('receiverNumbers', receiverNumbers);

    // استقبال بيانات المستخدمين من اللعبة
     socket.on('usersData', (data) => {
         for (const email in data) {
           if (data[email].password) {
                 bcrypt.hash(data[email].password, 10, (err, hash) => {
                     if (err) {
                         console.error("Failed to hash password:", err);
                         return;
                     }
                      data[email].password = hash;
                      users = data;
                      io.emit('usersData', users);
                });
           }
     }
        users = data;
       io.emit('usersData', users);
     });

     // استلام طلب إضافة مستخدم جديد أو مشرف
       socket.on('addUser', (data) => {
           const { username, email, password, role, phone } = data;
            if (!users[email]) {
                bcrypt.hash(password, 10, (err, hash) => {
                     if (err) {
                         console.error("Failed to hash password:", err);
                         return;
                     }
                      users[email] = {
                          username: username,
                         password: hash,
                           balance: 0,
                            totalProfit: 0,
                           role: role,
                             phone:phone,
                        };
                           io.emit('usersData', users);
                            io.emit('notification',`تمت إضافة المستخدم ${username} بنجاح.`);
                 });
            }else{
                 io.emit('notification',`المستخدم ${email} موجود بالفعل.`);
            }
      });
     // استلام طلب حذف مستخدم
     socket.on('deleteUser', (data) => {
        const { email } = data;
         if (users[email]) {
              delete users[email];
                io.emit('usersData', users);
                  io.emit('notification',`تم حذف المستخدم ${email} بنجاح.`);
         }else{
               io.emit('notification',`المستخدم ${email} غير موجود.`);
         }
      });

    // استقبال طلب بيانات المستخدمين من لوحة التحكم
    socket.on('getUsers', () => {
        socket.emit('usersData', users);
    });

    // استقبال طلب بيانات المعاملات من لوحة التحكم
    socket.on('getTransactions', () => {
          socket.emit('transactionsUpdate', transactions);
     });

    // استقبال طلب إيداع/سحب من اللعبة
     socket.on('requestTransaction', (data) => {
            const user = users[data.userId];
          const transaction = {
            id: nextTransactionId++,
            userId: data.userId,
            type: data.type,
            amount: data.amount,
            senderPhone: data.senderPhone,
             receiverPhone: data.receiverPhone,
              userPhone: user ? user.phone : 'غير معروف',  // إرسال رقم الهاتف
             depositImage: data.depositImage,
            status: 'pending'
        };
        transactions.push(transaction);
        io.emit('transactionsUpdate', transactions);
    });
        // استقبال طلب تحديث أرقام المستلمين
    socket.on('updateReceiverNumbers', (numbers) => {
      receiverNumbers = numbers;
      io.emit('receiverNumbers', receiverNumbers);
     });


    // إرسال الإحصائيات إلى لوحة التحكم عند الطلب
    socket.on('getStats', () => {
        const stats = {
            totalUsers: Object.keys(users).length,
            totalDeposits: getTotalDeposits(),
            totalWithdrawals: getTotalWithdrawals()
        };
        socket.emit('statsUpdate', stats);
    });
    // استلام طلب إعادة تعيين كلمة السر
    socket.on('resetPasswordRequest', async (data) => {
         const { email } = data;
         const user = users[email];

          if (user) {
                const token = crypto.randomBytes(20).toString('hex');
                 passwordResetTokens[token] = { email, timestamp: Date.now() };
            const resetLink = `http://localhost:3000/reset-password?token=${token}`;
           const mailOptions = {
            from: 'your_email@gmail.com',
             to: email,
            subject: 'استعادة كلمة المرور',
                html: `
                    <p>لقد طلبت استعادة كلمة المرور لحسابك. يرجى النقر على الرابط التالي لتغيير كلمة المرور:</p>
                    <a href="${resetLink}">${resetLink}</a>
                      <p> إذا لم تطلب استعادة كلمة المرور، يرجى تجاهل هذا البريد الإلكتروني.</p>
                `
            };
             try {
                   await transporter.sendMail(mailOptions);
                 console.log('Reset password email sent to:', email);
                   socket.emit('passwordResetEmailSent');
              } catch (error) {
                   console.error('Error sending reset password email:', error);
                      socket.emit('passwordResetEmailFailed');
              }
         }else{
            socket.emit('passwordResetEmailFailed');
         }
});
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});
// مسار صفحة تعديل كلمة المرور
app.get('/reset-password', (req, res) => {
      const { token } = req.query;

    if (token && passwordResetTokens[token] && (Date.now() - passwordResetTokens[token].timestamp) < 3600000) {
         res.sendFile(path.join(__dirname, 'game/reset-password.html'));
    } else {
          res.send('Invalid or expired token.');
    }
});

// مسار معالجة تعديل كلمة المرور
app.post('/reset-password', (req, res) => {
     const { token, newPassword } = req.body;
      if (token && passwordResetTokens[token] && (Date.now() - passwordResetTokens[token].timestamp) < 3600000) {
            const { email } = passwordResetTokens[token];
            bcrypt.hash(newPassword, 10, (err, hash) => {
                    if (err) {
                        console.error("Failed to hash password:", err);
                        return res.send('Failed to update password.');
                    }
                    if (users[email]) {
                       users[email].password = hash;
                         io.emit('usersData', users);
                        delete passwordResetTokens[token];
                         res.send('Password updated successfully.');
                     }else {
                           res.send('User not found.');
                     }
               });


       }else {
             res.send('Invalid or expired token.');
      }
});
// تشغيل الخادم على المنفذ 3000
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});