-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 28, 2024 at 12:55 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `db_library`
--

-- --------------------------------------------------------

--
-- Table structure for table `tb_book`
--

CREATE TABLE `tb_book` (
  `id` int(11) NOT NULL,
  `group_book_id` int(11) NOT NULL,
  `isbn` varchar(50) NOT NULL,
  `book_name` varchar(255) NOT NULL,
  `detail` varchar(255) NOT NULL,
  `img` varchar(255) NOT NULL,
  `author` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL,
  `price` decimal(11,2) DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_book`
--

INSERT INTO `tb_book` (`id`, `group_book_id`, `isbn`, `book_name`, `detail`, `img`, `author`, `status`, `price`, `stock`) VALUES
(24, 2, '111111', 'Algebra', 'Algebra', '51YCr-JaTwL._AC_UF1000,1000_QL80_.jpg', 'Unknown', 'Available', 199.00, 16),
(25, 2, '111112', 'MATH', 'MATH', 'images (1).jpg', 'Unknown', 'Available', 150.00, 30),
(26, 3, '111113', 'MATH2', 'MATH2', 'images (2).jpg', 'Unknown', 'Available', 189.00, 0),
(27, 7, '111114', 'Python', 'Python', 'images (3).jpg', 'Unknown', 'Available', 219.00, 6),
(28, 7, '111115', 'Python For Beginner', 'Are you looking to learn more about Machine Learning with Python?  Then Python Programming: The Ultimate Intermediate Guide to Learn Python Machine Learning Step-by-Step is the book for you!  The knowledge you learned in beginner-level programming will he', 'Python-Programming-for-Beginners-cover.jpg', 'Unknown', 'Available', 349.00, 73),
(29, 6, '111116', 'JAVA ฉบับสมบูรณ์', 'การทำความเข้าใจกับหลักการของ OOP จะช่วยให้เรียนรู้การเขียนโปรแกรมภาษาจาวาได้ไม่ยาก หนังสือเล่มนี้จึงมุ่งเน้นอธิบายให้เข้าใจหลักการของ OPP ก่อน คุณจะรู้สึกได้ว่าการเขียนโปรแกรมด้วยภาษาจาวาไม่ใช่เรื่องยากเลยแม้แต่นิดเดียว', '1000203773_front_XXL.jpg', 'Unknown', 'Available', 499.00, 1),
(31, 6, '111118', 'JAVA III', 'JAVA III', 'book_detail_large.gif', 'Unknown', 'Available', 149.00, 48),
(32, 2, '111119', 'CALCULUS', 'Application-oriented introduction relates the subject as closely as possible to science. In-depth explorations of the derivative, the differentiation and integration of the powers of x, and theorems on differentiation and antidifferentiation lead to a def', 'images.jpg', 'Unknown', 'Available', 590.00, 0),
(33, 7, '111120', 'PYTHON TH', 'Python', 'images.png', 'Unknown', 'Available', 1290.00, 57),
(38, 6, 'a', 'a', 'a', '9786162044632l.jpg', 'a', 'Available', 129.00, 7);

-- --------------------------------------------------------

--
-- Table structure for table `tb_borrow`
--

CREATE TABLE `tb_borrow` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `borrow_date` varchar(255) NOT NULL,
  `duration` enum('1','3','5','7','14') NOT NULL,
  `return_date` varchar(255) NOT NULL,
  `borrow_history_status` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_borrow`
--

INSERT INTO `tb_borrow` (`id`, `user_id`, `book_id`, `borrow_date`, `duration`, `return_date`, `borrow_history_status`) VALUES
(70, 1, 29, '03/04/2024 23:48:20', '5', '08/04/2024 23:48:20', 'Borrowed'),
(71, 1, 32, '03/04/2024 23:48:25', '5', '08/04/2024 23:48:25', 'Borrowed'),
(72, 1, 33, '03/04/2024 23:50:35', '1', '04/04/2024 23:50:35', 'Borrowed'),
(73, 9, 27, '03/04/2024 23:50:49', '1', '04/04/2024 23:50:49', 'Borrowed'),
(74, 1, 33, '25/10/2024 22:36:05', '1', '26/10/2024 22:36:05', 'Borrowed'),
(75, 1, 32, '25/10/2024 23:47:17', '1', '26/10/2024 23:47:17', 'Borrowed'),
(76, 1, 38, '26/10/2024 00:17:43', '1', '27/10/2024 00:17:43', 'Borrowed'),
(77, 1, 33, '28/10/2024 02:14:26', '1', '29/10/2024 02:14:26', 'Borrowed'),
(78, 1, 29, '28/10/2024 02:15:12', '1', '29/10/2024 02:15:12', 'Borrowed');

-- --------------------------------------------------------

--
-- Table structure for table `tb_group_book`
--

CREATE TABLE `tb_group_book` (
  `id` int(11) NOT NULL,
  `name_tag` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_group_book`
--

INSERT INTO `tb_group_book` (`id`, `name_tag`) VALUES
(2, 'หนังสือคณิตศาสตร์'),
(3, 'หนังสือวิทยาศาสตร์'),
(6, 'ภาษา Java'),
(7, 'ภาษา Python');

-- --------------------------------------------------------

--
-- Table structure for table `tb_history`
--

CREATE TABLE `tb_history` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `borrow_history_date` varchar(255) NOT NULL,
  `return_history_date` varchar(255) NOT NULL,
  `borrow_id` int(11) NOT NULL,
  `reserve_id` int(11) NOT NULL,
  `reserve_history_date` varchar(255) NOT NULL,
  `pickup_history_date` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_history`
--

INSERT INTO `tb_history` (`id`, `user_id`, `book_id`, `borrow_history_date`, `return_history_date`, `borrow_id`, `reserve_id`, `reserve_history_date`, `pickup_history_date`) VALUES
(77, 1, 28, '', '', 0, 22, '03/04/2024 23:48:17', '06/04/2024 23:48:17'),
(78, 1, 29, '03/04/2024 23:48:20', '08/04/2024 23:48:20', 70, 0, '', ''),
(79, 1, 32, '03/04/2024 23:48:25', '08/04/2024 23:48:25', 71, 0, '', ''),
(80, 1, 33, '03/04/2024 23:50:35', '04/04/2024 23:50:35', 72, 0, '', ''),
(81, 1, 31, '', '', 0, 23, '03/04/2024 23:50:42', '04/04/2024 23:50:42'),
(82, 9, 27, '03/04/2024 23:50:49', '04/04/2024 23:50:49', 73, 0, '', ''),
(83, 9, 26, '', '', 0, 24, '03/04/2024 23:50:53', '04/04/2024 23:50:53'),
(84, 1, 33, '25/10/2024 22:36:05', '26/10/2024 22:36:05', 74, 0, '', ''),
(85, 1, 32, '25/10/2024 23:47:17', '26/10/2024 23:47:17', 75, 0, '', ''),
(86, 1, 38, '26/10/2024 00:17:43', '27/10/2024 00:17:43', 76, 0, '', ''),
(87, 1, 33, '28/10/2024 02:14:26', '29/10/2024 02:14:26', 77, 0, '', ''),
(88, 1, 29, '28/10/2024 02:15:12', '29/10/2024 02:15:12', 78, 0, '', '');

-- --------------------------------------------------------

--
-- Table structure for table `tb_order`
--

CREATE TABLE `tb_order` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `order_date` datetime DEFAULT current_timestamp(),
  `total_amount` decimal(11,2) NOT NULL,
  `status` varchar(50) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_order`
--

INSERT INTO `tb_order` (`id`, `user_id`, `order_date`, `total_amount`, `status`) VALUES
(18, 1, '2024-10-28 18:53:04', 349.00, 'Completed');

-- --------------------------------------------------------

--
-- Table structure for table `tb_order_items`
--

CREATE TABLE `tb_order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(11,2) NOT NULL,
  `total_price` decimal(11,2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_order_items`
--

INSERT INTO `tb_order_items` (`id`, `order_id`, `book_id`, `quantity`, `unit_price`) VALUES
(23, 18, 28, 1, 349.00),
(24, 18, 27, 1, 0.00),
(25, 18, 28, 1, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `tb_promotion`
--

CREATE TABLE `tb_promotion` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `detail` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `startdate` date NOT NULL,
  `enddate` date NOT NULL,
  `quantity` int(11) DEFAULT NULL,
  `coupon_code` varchar(255) NOT NULL,
  `discount` decimal(11,2) DEFAULT NULL,
  `book_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_promotion`
--

INSERT INTO `tb_promotion` (`id`, `name`, `detail`, `type`, `startdate`, `enddate`, `quantity`, `coupon_code`, `discount`, `book_id`) VALUES
(2, 'DISCOUNT10% FOR 1 MONTH', 'DISCOUNT10% FOR 1 MONTH FOR FIRST CUSTOMER', 'discount', '2024-10-01', '2024-10-31', 5, 'FIRST10', 10.00, 0),
(4, 'FREE PYTHON', 'FREE PYTHON ', 'free_book', '2024-10-01', '2024-10-31', 4, 'PYTHONFR', 0.00, 27),
(5, 'FREE PYTHON', 'FREE PYTHON ', 'free_book', '2024-10-01', '2024-10-31', 5, 'PYTHONFR', 0.00, 28);

-- --------------------------------------------------------

--
-- Table structure for table `tb_reserve`
--

CREATE TABLE `tb_reserve` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `reserve_date` varchar(255) NOT NULL,
  `pickup_date` varchar(255) NOT NULL,
  `duration` enum('1','2','3','') NOT NULL,
  `reserve_history_status` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_reserve`
--

INSERT INTO `tb_reserve` (`id`, `user_id`, `book_id`, `reserve_date`, `pickup_date`, `duration`, `reserve_history_status`) VALUES
(22, 1, 28, '03/04/2024 23:48:17', '06/04/2024 23:48:17', '3', 'Reserved'),
(23, 1, 31, '03/04/2024 23:50:42', '04/04/2024 23:50:42', '1', 'Reserved'),
(24, 9, 26, '03/04/2024 23:50:53', '04/04/2024 23:50:53', '1', 'Reserved');

-- --------------------------------------------------------

--
-- Table structure for table `tb_user`
--

CREATE TABLE `tb_user` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `usr` varchar(255) NOT NULL,
  `pwd` varchar(255) NOT NULL,
  `level` varchar(50) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `img` varchar(255) DEFAULT NULL,
  `citizencard` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tb_user`
--

INSERT INTO `tb_user` (`id`, `name`, `usr`, `pwd`, `level`, `phone`, `img`, `citizencard`) VALUES
(1, 'PANNAWAT KHOOKAEW', 'admin', '1', 'admin', '02555555', '103985836_p0.png', '43214312'),
(7, 'test', 'test1', '1', 'user', '0255555555', 'a14b87bfd1d5c37f6b1354f7d3d2a685.jpg', '3421312312'),
(9, 'LibrarianTest', 'test', '2', 'librarian', '00000001', '587491718883049481.webp', '412341233'),
(36, 'PANNAWAT ', 'user1', '123', 'user', '0222222222', '197535993b10e7ea5f40763f3c185c4214a985ceadafb859ed74864a3103a67f.png', '11111111111'),
(38, 'admin2', 'admin2', '2', 'user', '0', NULL, '0');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tb_book`
--
ALTER TABLE `tb_book`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_borrow`
--
ALTER TABLE `tb_borrow`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_group_book`
--
ALTER TABLE `tb_group_book`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_history`
--
ALTER TABLE `tb_history`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_order`
--
ALTER TABLE `tb_order`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `tb_order_items`
--
ALTER TABLE `tb_order_items`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_promotion`
--
ALTER TABLE `tb_promotion`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_reserve`
--
ALTER TABLE `tb_reserve`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tb_user`
--
ALTER TABLE `tb_user`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tb_book`
--
ALTER TABLE `tb_book`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `tb_borrow`
--
ALTER TABLE `tb_borrow`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `tb_group_book`
--
ALTER TABLE `tb_group_book`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `tb_history`
--
ALTER TABLE `tb_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT for table `tb_order`
--
ALTER TABLE `tb_order`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `tb_order_items`
--
ALTER TABLE `tb_order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `tb_promotion`
--
ALTER TABLE `tb_promotion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `tb_reserve`
--
ALTER TABLE `tb_reserve`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `tb_user`
--
ALTER TABLE `tb_user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tb_order`
--
ALTER TABLE `tb_order`
  ADD CONSTRAINT `tb_order_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tb_user` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
