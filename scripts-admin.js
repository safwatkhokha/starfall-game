const socket = io('http://localhost:3000');

let users = {};
let transactions = [];
let receiverNumbers = {};
let usersChart, transactionsChart;

document.addEventListener('DOMContentLoaded', () => {
    // إضافة مستمع للأقسام الجانبية
    document.querySelectorAll('.sidebar-menu a').forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const sectionId = item.getAttribute('data-section') + '-section';
             showSection(sectionId);
           });
    });
     // إنشاء المخططات عند تحميل الصفحة
    createCharts();
});

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
     });     document.getElementById(sectionId).style.display = 'block';
     document.querySelectorAll('.sidebar-menu a').forEach(item => {
          item.classList.remove('active');
      });
         const sectionLink = document.querySelector(`.sidebar-menu a[data-section="${sectionId.replace('-section', '')}"]`)
       if (sectionLink) {
        sectionLink.classList.add('active');
     }
 
 }
 // استقبال بيانات المستخدمين وتحديث الجدول
 socket.on('usersData', (data) => {
     users = data;
     updateUsersTable();
 });
 
 // استقبال بيانات المعاملات وتحديث الجدول
 socket.on('transactionsUpdate', (data) => {
     transactions = data;
     updateTransactionsTable();
 });
 
 // استقبال أرقام التحويل وتحديث الجدول
 socket.on('receiverNumbers', (data) => {
     receiverNumbers = data;
     updateReceiverNumbersTable();
 });
 
 socket.on('statsUpdate', (data) => {
     document.getElementById('totalUsers').textContent = data.totalUsers;
     document.getElementById('totalDeposits').textContent = data.totalDeposits.toFixed(2);
     document.getElementById('totalWithdrawals').textContent = data.totalWithdrawals.toFixed(2);
     updateCharts(data);
 });
 // استقبال الإشعارات
 socket.on('notification', (message) => {
    showNotification(message);
 });
 
 // دالة لتحديث جدول المستخدمين
 function updateUsersTable(filteredUsers = users) {
     const table = document.getElementById('usersTable').getElementsByTagName('tbody')[0];
     table.innerHTML = '';
     for (const email in filteredUsers) {
         const user = filteredUsers[email];
         const row = table.insertRow();
         row.insertCell(0).textContent = email;
         row.insertCell(1).textContent = user.username;
          row.insertCell(2).textContent = user.phone;
         row.insertCell(3).textContent = user.balance.toFixed(2);
          row.insertCell(4).textContent = user.role;
          const deleteCell = row.insertCell(5);
             const deleteButton = document.createElement('button');
             deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
              deleteButton.classList.add('delete-button');
             deleteButton.onclick = () => deleteUser(email);
             deleteCell.appendChild(deleteButton);
      }
 }
 
 function updateTransactionsTable(filteredTransactions = transactions) {
     const table = document.getElementById('transactionsTable').getElementsByTagName('tbody')[0];
     table.innerHTML = '';
     filteredTransactions.forEach(transaction => {
         const row = table.insertRow();
         row.insertCell(0).textContent = transaction.userId;
         row.insertCell(1).textContent = transaction.type;
         row.insertCell(2).textContent = transaction.amount.toFixed(2);
         row.insertCell(3).textContent = transaction.senderPhone || '';
         row.insertCell(4).textContent = transaction.receiverPhone || '';
          row.insertCell(5).textContent = transaction.userPhone || 'غير معروف'; // عرض رقم هاتف المستخدم
          const imgCell = row.insertCell(6);
          if (transaction.depositImage) {
              const img = document.createElement('img');
             img.src = transaction.depositImage;
             img.style.maxWidth = '50px';
             img.style.maxHeight = '50px';
             img.style.cursor = 'pointer';
             img.onclick = () => showImageModal(transaction.depositImage); // إضافة وظيفة لتكبير الصورة
              imgCell.appendChild(img);
          } else {
              imgCell.textContent = 'لا يوجد صورة';
          }
         row.insertCell(7).textContent = transaction.status;
          const approveButtonCell = row.insertCell(8);
           if (transaction.status === 'pending') {
              const approveDepositButton = document.createElement('button');
               approveDepositButton.textContent = 'موافقة على الإيداع';
               approveDepositButton.onclick = () => approveTransaction(transaction.id, 'deposit');
                const approveWithdrawalButton = document.createElement('button');
                 approveWithdrawalButton.textContent = 'موافقة على السحب';
                 approveWithdrawalButton.onclick = () => approveTransaction(transaction.id, 'withdrawal');
                if (transaction.type === 'deposit') {
                   approveButtonCell.appendChild(approveDepositButton);
                 } else if (transaction.type === 'withdrawal') {
                     approveButtonCell.appendChild(approveWithdrawalButton);
                 }
         } else {
             approveButtonCell.textContent = 'تمت الموافقة';
        }
     });
 }
 
 function approveTransaction(transactionId, type) {
     fetch('/approve-transaction', {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
         },
         body: JSON.stringify({ transactionId: transactionId, type: type }),
     })
         .then(response => response.json())
         .then(data => {
             if (data.success) {
                 alert(data.message);
                 socket.emit('getTransactions');
                 socket.emit('getUsers');
                 socket.emit('getStats');
             } else {
                 alert('فشل في الموافقة: ' + data.message);
             }
         })
         .catch(error => console.error('Error:', error));
 }
 function updateReceiverNumbersTable(filteredNumbers = receiverNumbers) {
     const table = document.getElementById('receiverNumbersTable').getElementsByTagName('tbody')[0];
     table.innerHTML = '';
     for (const number in filteredNumbers) {
         const row = table.insertRow();
         row.insertCell(0).textContent = number;
         row.insertCell(1).textContent = filteredNumbers[number];
         const editCell = row.insertCell(2);
         const editButton = document.createElement('button');
         editButton.textContent = 'تعديل';
         editButton.onclick = () => editReceiverNumber(number, row);
         editCell.appendChild(editButton);
 
           const deleteCell = row.insertCell(3);
             const deleteButton = document.createElement('button');
             deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
              deleteButton.classList.add('delete-button');
             deleteButton.onclick = () => deleteReceiverNumber(number);
             deleteCell.appendChild(deleteButton);
     }
 }
 
 function editReceiverNumber(number, row) {
     // تحويل الصف إلى وضع التعديل
     row.cells[0].innerHTML = `<input type="tel" value="${number}" class="edit-number">`;
     row.cells[1].innerHTML = `<select class="edit-network">
         <option value="vodafone" ${receiverNumbers[number] === 'فودافون' ? 'selected' : ''}>فودافون</option>
         <option value="orange" ${receiverNumbers[number] === 'اورنج' ? 'selected' : ''}>اورنج</option>
           <option value="etisalat" ${receiverNumbers[number] === 'اتصالات' ? 'selected' : ''}>اتصالات</option>
            <option value="we" ${receiverNumbers[number] === 'we' ? 'selected' : ''}>وي</option>
     </select>`;
 
     const editButton = row.cells[2].querySelector('button');
     editButton.textContent = 'حفظ';
     editButton.onclick = () => saveReceiverNumber(number, row);
 }
 
 function saveReceiverNumber(number, row) {
     const newNumber = row.cells[0].querySelector('.edit-number').value;
     const newNetwork = row.cells[1].querySelector('.edit-network').value;
     if (newNumber && newNetwork) {
            const newReceiverNumbers = {};
               for (const key in receiverNumbers) {
                     if (key != number) {
                          newReceiverNumbers[key] = receiverNumbers[key];
                         }
                    }
               newReceiverNumbers[newNumber] = newNetwork;
             receiverNumbers = newReceiverNumbers;
              socket.emit('updateReceiverNumbers', receiverNumbers);
          updateReceiverNumbersTable();
            showNotification("تم تعديل رقم التحويل بنجاح");
     }else{
          showNotification("يجب إدخال رقم وشبكة صالحة");
     }
 }
 
 function addReceiverNumber() {
   const newNumber = document.getElementById('newReceiverNumber').value;
   const newNetwork = document.getElementById('newReceiverNetwork').value;
 
     if (newNumber && newNetwork) {
            const newReceiverNumbers = {};
               for (const key in receiverNumbers) {
                     newReceiverNumbers[key] = receiverNumbers[key];
                    }
               newReceiverNumbers[newNumber] = newNetwork;
             receiverNumbers = newReceiverNumbers;
          socket.emit('updateReceiverNumbers', receiverNumbers);
            updateReceiverNumbersTable();
             document.getElementById('newReceiverNumber').value = '';
             showNotification("تمت إضافة رقم التحويل بنجاح");
     } else {
             showNotification("يجب إدخال رقم وشبكة صالحة");
     }
 }
 function deleteReceiverNumber(number) {
         if (confirm(`هل أنت متأكد أنك تريد حذف الرقم ${number}؟`)) {
               const newReceiverNumbers = {};
               for (const key in receiverNumbers) {
                     if (key != number) {
                          newReceiverNumbers[key] = receiverNumbers[key];
                         }
                    }
               receiverNumbers = newReceiverNumbers;
             socket.emit('updateReceiverNumbers', receiverNumbers);
           updateReceiverNumbersTable();
              showNotification(`تم حذف رقم التحويل ${number} بنجاح`);
     }
 }
 document.getElementById('searchReceiverNumbers').addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    let filteredNumbers = {};
     for (const number in receiverNumbers) {
         if(number.includes(searchTerm) || receiverNumbers[number].toLowerCase().includes(searchTerm)) {
           filteredNumbers[number] = receiverNumbers[number];
         }
     }
     updateReceiverNumbersTable(filteredNumbers);
 });
 document.getElementById('searchInputUsers').addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const table = document.getElementById('usersTable').getElementsByTagName('tbody')[0];
     const rows = table.getElementsByTagName('tr');
 
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
          const email = row.cells[0].textContent.toLowerCase();
            const username = row.cells[1].textContent.toLowerCase();
             const phone = row.cells[2].textContent.toLowerCase();
 
       if (email.includes(searchTerm) || username.includes(searchTerm) || phone.includes(searchTerm)) {
             row.style.display = '';
        } else {
           row.style.display = 'none';
       }
    }
 });
  socket.emit('getUsers');
  socket.emit('getTransactions');
  socket.emit('getStats');
    socket.emit('getReceiverNumbers');
 
 function createCharts() {
    const usersCtx = document.getElementById('usersChart').getContext('2d');
    usersChart = new Chart(usersCtx, {
        type: 'bar',
        data: {
            labels: ['المستخدمين'],
            datasets: [{
                label: 'عدد المستخدمين',
                data: [0],
                backgroundColor: '#4CAF50'
            }]
        },
          options: {
              responsive: true, // Make chart responsive
              maintainAspectRatio: false, // Don't maintain aspect ratio
            scales: {
              y: {
                 beginAtZero: true,
                   precision: 0,
              }
            },
        }
    });
        const transactionsCtx = document.getElementById('transactionsChart').getContext('2d');
          transactionsChart = new Chart(transactionsCtx, {
            type: 'pie',
            data: {
                labels: ['الإيداعات', 'السحوبات'],
                datasets: [{
                    label: 'إجمالي المعاملات',
                    data: [0, 0],
                    backgroundColor: ['#2196F3', '#F44336']
                }]
            },
        options: {
             responsive: true, // Make chart responsive
             maintainAspectRatio: false, // Don't maintain aspect ratio
        }
    });
 }
 
 function updateCharts(data) {
     if(usersChart) {
      usersChart.data.datasets[0].data = [data.totalUsers];
      usersChart.update();
    }
 
     if(transactionsChart) {
      transactionsChart.data.datasets[0].data = [data.totalDeposits,data.totalWithdrawals];
        transactionsChart.update();
    }
 }
 function applyUserFilters() {
    const balanceFilter = document.getElementById('filterBalanceUsers').value;
    let filteredUsers = { ...users };
      if (balanceFilter !== 'all') {
        const usersArray = Object.entries(filteredUsers)
        usersArray.sort(([, userA], [, userB]) => {
            if(balanceFilter === 'high'){
               return userB.balance - userA.balance
            }else{
               return userA.balance - userB.balance
             }
            });
        filteredUsers = Object.fromEntries(usersArray);
    }
    updateUsersTable(filteredUsers);
 }
 function applyTransactionFilters() {
    const typeFilter = document.getElementById('filterTypeTransactions').value;
    const statusFilter = document.getElementById('filterStatusTransactions').value;
    let filteredTransactions = [...transactions];
      if (typeFilter !== 'all') {
         filteredTransactions = filteredTransactions.filter(transaction => transaction.type === typeFilter);
    }
    if (statusFilter !== 'all') {
           filteredTransactions = filteredTransactions.filter(transaction => transaction.status === statusFilter);
    }
    updateTransactionsTable(filteredTransactions);
 }
 function addUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newUserEmail').value;
     const phone = document.getElementById('newUserPhone').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    if (username && email && password && role && phone) {
            socket.emit('addUser', {
            username: username,
            email: email,
            password: password,
              phone:phone,
             role: role
            });
           clearAddUserInputs()
    } else {
        alert('الرجاء إدخال جميع البيانات المطلوبة.');
    }
 }
 function clearAddUserInputs() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
      document.getElementById('newUserPhone').value = '';
 }
 function deleteUser(email) {
     if (confirm(`هل أنت متأكد أنك تريد حذف المستخدم ${email}؟`)) {
          socket.emit('deleteUser', {
            email: email
          });
    }
 }
 function showNotification(message) {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
        notification.classList.add('notification');
    notification.innerHTML =  `<i class="fas fa-info-circle"></i> ${message}`;
    notificationArea.appendChild(notification);
      setTimeout(() => {
           notification.classList.add('show');
        }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
 }
 
 function showImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    modal.style.display = "block";
     modalImage.src = imageSrc;
 
    const closeModal = document.querySelector('.close-modal');
    closeModal.onclick = function() {
        modal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
 }