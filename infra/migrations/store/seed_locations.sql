-- Seed Initial 66 Districts (8 Divisions) and key Thanas with Zone Rates
-- Zone 1: Inside Dhaka (City) - ৳80.00
-- Zone 2: Dhaka Suburbs (Sub-Urban) - ৳110.00
-- Zone 3: Outside Dhaka (Nationwide) - ৳130.00

-- Division 1: Dhaka
INSERT INTO districts (name, division, is_active) VALUES
('Dhaka City', 'Dhaka', true),
('Dhaka Sub-Urban', 'Dhaka', true),
('Gazipur', 'Dhaka', true),
('Narayanganj', 'Dhaka', true),
('Narsingdi', 'Dhaka', true),
('Manikganj', 'Dhaka', true),
('Munshiganj', 'Dhaka', true),
('Tangail', 'Dhaka', true),
('Faridpur', 'Dhaka', true),
('Gopalganj', 'Dhaka', true),
('Madaripur', 'Dhaka', true),
('Rajbari', 'Dhaka', true),
('Shariatpur', 'Dhaka', true)
ON CONFLICT (name) DO NOTHING;

-- Division 2: Chattogram
INSERT INTO districts (name, division, is_active) VALUES
('Chattogram', 'Chattogram', true),
('Cox''s Bazar', 'Chattogram', true),
('Cumilla', 'Chattogram', true),
('Brahmanbaria', 'Chattogram', true),
('Chandpur', 'Chattogram', true),
('Feni', 'Chattogram', true),
('Lakshmipur', 'Chattogram', true),
('Noakhali', 'Chattogram', true),
('Khagrachhari', 'Chattogram', true),
('Rangamati', 'Chattogram', true),
('Bandarban', 'Chattogram', true)
ON CONFLICT (name) DO NOTHING;

-- Division 3: Rajshahi
INSERT INTO districts (name, division, is_active) VALUES
('Rajshahi', 'Rajshahi', true),
('Bogura', 'Rajshahi', true),
('Pabna', 'Rajshahi', true),
('Sirajganj', 'Rajshahi', true),
('Naogaon', 'Rajshahi', true),
('Natore', 'Rajshahi', true),
('Chapainawabganj', 'Rajshahi', true),
('Joypurhat', 'Rajshahi', true)
ON CONFLICT (name) DO NOTHING;

-- Division 4: Khulna
INSERT INTO districts (name, division, is_active) VALUES
('Khulna', 'Khulna', true),
('Jashore', 'Khulna', true),
('Kushtia', 'Khulna', true),
('Jhenaidah', 'Khulna', true),
('Bagerhat', 'Khulna', true),
('Satkhira', 'Khulna', true),
('Chuadanga', 'Khulna', true),
('Meherpur', 'Khulna', true),
('Narail', 'Khulna', true),
('Magura', 'Khulna', true)
ON CONFLICT (name) DO NOTHING;

-- Division 5: Barishal
INSERT INTO districts (name, division, is_active) VALUES
('Barishal', 'Barishal', true),
('Bhola', 'Barishal', true),
('Patuakhali', 'Barishal', true),
('Pirojpur', 'Barishal', true),
('Barguna', 'Barishal', true),
('Jhalokati', 'Barishal', true)
ON CONFLICT (name) DO NOTHING;

-- Division 6: Sylhet
INSERT INTO districts (name, division, is_active) VALUES
('Sylhet', 'Sylhet', true),
('Moulvibazar', 'Sylhet', true),
('Habiganj', 'Sylhet', true),
('Sunamganj', 'Sylhet', true)
ON CONFLICT (name) DO NOTHING;

-- Division 7: Rangpur
INSERT INTO districts (name, division, is_active) VALUES
('Rangpur', 'Rangpur', true),
('Dinajpur', 'Rangpur', true),
('Gaibandha', 'Rangpur', true),
('Kurigram', 'Rangpur', true),
('Lalmonirhat', 'Rangpur', true),
('Nilphamari', 'Rangpur', true),
('Panchagarh', 'Rangpur', true),
('Thakurgaon', 'Rangpur', true)
ON CONFLICT (name) DO NOTHING;

-- Division 8: Mymensingh
INSERT INTO districts (name, division, is_active) VALUES
('Mymensingh', 'Mymensingh', true),
('Jamalpur', 'Mymensingh', true),
('Netrokona', 'Mymensingh', true),
('Sherpur', 'Mymensingh', true)
ON CONFLICT (name) DO NOTHING;

-- Seed Dhaka City Thanas (Zone 1 - ৳80.00)
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Dhaka City';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Dhanmondi', 80.00, true),
        (d_id, 'Gulshan', 80.00, true),
        (d_id, 'Banani', 80.00, true),
        (d_id, 'Uttara', 80.00, true),
        (d_id, 'Mirpur', 80.00, true),
        (d_id, 'Mohammadpur', 80.00, true),
        (d_id, 'Motijheel', 80.00, true),
        (d_id, 'Badda', 80.00, true),
        (d_id, 'Adabor', 80.00, true),
        (d_id, 'Bangshal', 80.00, true),
        (d_id, 'Chalkbazar', 80.00, true),
        (d_id, 'Demra', 80.00, true),
        (d_id, 'Gandaria', 80.00, true),
        (d_id, 'Hazaribagh', 80.00, true),
        (d_id, 'Jatrabari', 80.00, true),
        (d_id, 'Kafrul', 80.00, true),
        (d_id, 'Kalabagan', 80.00, true),
        (d_id, 'Kamrangirchar', 80.00, true),
        (d_id, 'Khilgaon', 80.00, true),
        (d_id, 'Kotwali (Dhaka)', 80.00, true),
        (d_id, 'Lalbagh', 80.00, true),
        (d_id, 'New Market', 80.00, true),
        (d_id, 'Paltan', 80.00, true),
        (d_id, 'Ramna', 80.00, true),
        (d_id, 'Rampura', 80.00, true),
        (d_id, 'Sabujbagh', 80.00, true),
        (d_id, 'Shah Ali', 80.00, true),
        (d_id, 'Shahbag', 80.00, true),
        (d_id, 'Sher-e-Bangla Nagar', 80.00, true),
        (d_id, 'Shyampur', 80.00, true),
        (d_id, 'Sutrapur', 80.00, true),
        (d_id, 'Tejgaon', 80.00, true),
        (d_id, 'Tejgaon Industrial Area', 80.00, true),
        (d_id, 'Vasantek', 80.00, true),
        (d_id, 'Wari', 80.00, true),
        (d_id, 'Bhatara', 80.00, true),
        (d_id, 'Pallabi', 80.00, true),
        (d_id, 'Rupnagar', 80.00, true),
        (d_id, 'Dakshinkhan', 80.00, true),
        (d_id, 'Uttarkhan', 80.00, true),
        (d_id, 'Turag', 80.00, true),
        (d_id, 'Khilkhet', 80.00, true),
        (d_id, 'Vatara', 80.00, true),
        (d_id, 'Cantonment', 80.00, true),
        (d_id, 'Sherebanglanagar', 80.00, true),
        (d_id, 'Mugda', 80.00, true),
        (d_id, 'Kadamtali', 80.00, true),
        (d_id, 'Gendaria', 80.00, true),
        (d_id, 'Banglamotor', 80.00, true),
        (d_id, 'Elephant Road', 80.00, true),
        (d_id, 'Farmgate', 80.00, true),
        (d_id, 'Malibagh', 80.00, true),
        (d_id, 'Moghbazar', 80.00, true),
        (d_id, 'Shantinagar', 80.00, true),
        (d_id, 'Kakrail', 80.00, true),
        (d_id, 'Segunbagicha', 80.00, true),
        (d_id, 'Bijoynagar', 80.00, true),
        (d_id, 'Shahjahanpur', 80.00, true),
        (d_id, 'Basabo', 80.00, true),
        (d_id, 'Gopibagh', 80.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Seed Dhaka Sub-Urban Thanas (Zone 2 - ৳110.00)
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Dhaka Sub-Urban';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Savar', 110.00, true),
        (d_id, 'Ashulia', 110.00, true),
        (d_id, 'Keraniganj', 110.00, true),
        (d_id, 'Dhamrai', 110.00, true),
        (d_id, 'Dohar', 110.00, true),
        (d_id, 'Nawabganj', 110.00, true),
        (d_id, 'Tongi', 110.00, true),
        (d_id, 'Birulia', 110.00, true),
        (d_id, 'Aminbazar', 110.00, true),
        (d_id, 'Hemayetpur', 110.00, true),
        (d_id, 'Baipail', 110.00, true),
        (d_id, 'Zirani', 110.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Seed Chattogram Thanas (Zone 3 - ৳130.00)
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Chattogram';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Kotwali', 130.00, true),
        (d_id, 'Panchlaish', 130.00, true),
        (d_id, 'Pahartali', 130.00, true),
        (d_id, 'Halishahar', 130.00, true),
        (d_id, 'Patenga', 130.00, true),
        (d_id, 'Doublemooring', 130.00, true),
        (d_id, 'Khulshi', 130.00, true),
        (d_id, 'Chandgaon', 130.00, true),
        (d_id, 'Bakolia', 130.00, true),
        (d_id, 'Bayazid', 130.00, true),
        (d_id, 'Karnaphuli', 130.00, true),
        (d_id, 'Sitakunda', 130.00, true),
        (d_id, 'Mirsharai', 130.00, true),
        (d_id, 'Hathazari', 130.00, true),
        (d_id, 'Raozan', 130.00, true),
        (d_id, 'Rangunia', 130.00, true),
        (d_id, 'Patiya', 130.00, true),
        (d_id, 'Boalkhali', 130.00, true),
        (d_id, 'Anwara', 130.00, true),
        (d_id, 'Chandanaish', 130.00, true),
        (d_id, 'Satkania', 130.00, true),
        (d_id, 'Lohagara', 130.00, true),
        (d_id, 'Banshkhali', 130.00, true),
        (d_id, 'Sandwip', 130.00, true),
        (d_id, 'Fatikchhari', 130.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Seed Bogura (Zone 3 - ৳130.00)
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Bogura';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Bogura Sadar', 130.00, true),
        (d_id, 'Sherpur (Bogura)', 130.00, true),
        (d_id, 'Shibganj', 130.00, true),
        (d_id, 'Gabtali', 130.00, true),
        (d_id, 'Shahjahanpur (Bogura)', 130.00, true),
        (d_id, 'Kahalu', 130.00, true),
        (d_id, 'Nandigram', 130.00, true),
        (d_id, 'Dhunat', 130.00, true),
        (d_id, 'Sariakandi', 130.00, true),
        (d_id, 'Sonatola', 130.00, true),
        (d_id, 'Adamdighi', 130.00, true),
        (d_id, 'Dupchanchia', 130.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Seed Sylhet (Zone 3 - ৳130.00)
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Sylhet';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Sylhet Sadar', 130.00, true),
        (d_id, 'Kotwali (Sylhet)', 130.00, true),
        (d_id, 'South Surma', 130.00, true),
        (d_id, 'Beanibazar', 130.00, true),
        (d_id, 'Golapganj', 130.00, true),
        (d_id, 'Biswanath', 130.00, true),
        (d_id, 'Balaganj', 130.00, true),
        (d_id, 'Fenchuganj', 130.00, true),
        (d_id, 'Osmani Nagar', 130.00, true),
        (d_id, 'Gowainghat', 130.00, true),
        (d_id, 'Jaintiapur', 130.00, true),
        (d_id, 'Kanaighat', 130.00, true),
        (d_id, 'Companiganj', 130.00, true),
        (d_id, 'Zakiganj', 130.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Seed Rajshahi, Khulna, Gazipur, Narayanganj Thanas
DO $$
DECLARE
    d_id INT;
BEGIN
    SELECT id INTO d_id FROM districts WHERE name = 'Gazipur';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Gazipur Sadar', 110.00, true),
        (d_id, 'Joydebpur', 110.00, true),
        (d_id, 'Kaliakair', 110.00, true),
        (d_id, 'Kapasia', 110.00, true),
        (d_id, 'Sreepur', 110.00, true),
        (d_id, 'Kaliganj (Gazipur)', 110.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;

    SELECT id INTO d_id FROM districts WHERE name = 'Narayanganj';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Narayanganj Sadar', 110.00, true),
        (d_id, 'Bandar', 110.00, true),
        (d_id, 'Fatullah', 110.00, true),
        (d_id, 'Siddhirganj', 110.00, true),
        (d_id, 'Sonargaon', 110.00, true),
        (d_id, 'Araihazar', 110.00, true),
        (d_id, 'Rupganj', 110.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;

    SELECT id INTO d_id FROM districts WHERE name = 'Rajshahi';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Boalia', 130.00, true),
        (d_id, 'Motihar', 130.00, true),
        (d_id, 'Rajpara', 130.00, true),
        (d_id, 'Shah Makhdum', 130.00, true),
        (d_id, 'Paba', 130.00, true),
        (d_id, 'Godagari', 130.00, true),
        (d_id, 'Tanore', 130.00, true),
        (d_id, 'Bagmara', 130.00, true),
        (d_id, 'Durgapur', 130.00, true),
        (d_id, 'Charghat', 130.00, true),
        (d_id, 'Bagha', 130.00, true),
        (d_id, 'Puthia', 130.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;

    SELECT id INTO d_id FROM districts WHERE name = 'Khulna';
    IF d_id IS NOT NULL THEN
        INSERT INTO thanas (district_id, name, shipping_cost, is_active) VALUES
        (d_id, 'Khulna Sadar', 130.00, true),
        (d_id, 'Sonadanga', 130.00, true),
        (d_id, 'Khalishpur', 130.00, true),
        (d_id, 'Daulatpur', 130.00, true),
        (d_id, 'Khan Jahan Ali', 130.00, true),
        (d_id, 'Dumuria', 130.00, true),
        (d_id, 'Rupsha', 130.00, true),
        (d_id, 'Batiaghata', 130.00, true),
        (d_id, 'Phultala', 130.00, true),
        (d_id, 'Dighalia', 130.00, true),
        (d_id, 'Terokhada', 130.00, true),
        (d_id, 'Paikgachha', 130.00, true),
        (d_id, 'Koyra', 130.00, true),
        (d_id, 'Dakop', 130.00, true)
        ON CONFLICT (district_id, name) DO NOTHING;
    END IF;
END $$;

-- Populate default delivery_zones from districts and thanas for backwards compatibility with storefront
INSERT INTO delivery_zones (district, zone, shipping_fee, thanas)
SELECT 
    d.name as district,
    d.division || ' Zone' as zone,
    COALESCE(AVG(t.shipping_cost), 120.00) as shipping_fee,
    COALESCE(ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[d.name]) as thanas
FROM districts d
LEFT JOIN thanas t ON t.district_id = d.id AND t.is_active = true
WHERE d.is_active = true
GROUP BY d.name, d.division
ON CONFLICT (district, zone) DO UPDATE 
SET shipping_fee = EXCLUDED.shipping_fee, thanas = EXCLUDED.thanas;
