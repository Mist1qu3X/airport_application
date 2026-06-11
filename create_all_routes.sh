TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNaXN0MXF1M1giLCJleHAiOjE3ODExNzE1NDQsImlhdCI6MTc4MTE2Nzk0NCwidHlwZSI6ImFjY2VzcyJ9.n50hzliux3PocY4Wt_BqBWSwpajAXdphzdes0zcgUmg'

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((12 + i)); HOUR=$((6 + i % 10)); PRICE=$((3500 + (i * 300)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU10$(printf "%02d" $i)\",\"airline\":\"Аэрофлот\",\"origin\":\"Москва\",\"destination\":\"Сочи\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+2))):30:00\",\"status\":\"scheduled\",\"capacity\":180,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Сочи #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((13 + i)); HOUR=$((7 + i % 10)); PRICE=$((2800 + (i * 200)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU20$(printf "%02d" $i)\",\"airline\":\"S7 Airlines\",\"origin\":\"Москва\",\"destination\":\"Санкт-Петербург\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+1))):30:00\",\"status\":\"scheduled\",\"capacity\":160,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→СПб #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((14 + i)); HOUR=$((8 + i % 10)); PRICE=$((3200 + (i * 250)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU30$(printf "%02d" $i)\",\"airline\":\"Победа\",\"origin\":\"Москва\",\"destination\":\"Казань\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+1))):50:00\",\"status\":\"scheduled\",\"capacity\":189,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Казань #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((15 + i)); HOUR=$((9 + i % 10)); PRICE=$((4500 + (i * 300)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU40$(printf "%02d" $i)\",\"airline\":\"Уральские авиалинии\",\"origin\":\"Москва\",\"destination\":\"Калининград\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+2))):00:00\",\"status\":\"scheduled\",\"capacity\":150,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Калининград #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((16 + i)); HOUR=$((6 + i % 10)); PRICE=$((6000 + (i * 350)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU50$(printf "%02d" $i)\",\"airline\":\"Аэрофлот\",\"origin\":\"Москва\",\"destination\":\"Екатеринбург\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+2))):30:00\",\"status\":\"scheduled\",\"capacity\":180,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Екатеринбург #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((17 + i)); HOUR=$((7 + i % 10)); PRICE=$((7000 + (i * 400)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU60$(printf "%02d" $i)\",\"airline\":\"S7 Airlines\",\"origin\":\"Москва\",\"destination\":\"Новосибирск\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+4))):00:00\",\"status\":\"scheduled\",\"capacity\":160,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Новосибирск #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((13 + i)); HOUR=$((8 + i % 10)); PRICE=$((3800 + (i * 250)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU70$(printf "%02d" $i)\",\"airline\":\"Победа\",\"origin\":\"Москва\",\"destination\":\"Краснодар\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+2))):00:00\",\"status\":\"scheduled\",\"capacity\":189,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Краснодар #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((18 + i)); HOUR=$((10 + i % 8)); PRICE=$((10000 + (i * 500)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU80$(printf "%02d" $i)\",\"airline\":\"Аэрофлот\",\"origin\":\"Москва\",\"destination\":\"Владивосток\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+8))):00:00\",\"status\":\"scheduled\",\"capacity\":180,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Владивосток #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((14 + i)); HOUR=$((6 + i % 10)); PRICE=$((5500 + (i * 300)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU90$(printf "%02d" $i)\",\"airline\":\"Nordwind\",\"origin\":\"Москва\",\"destination\":\"Мурманск\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+2))):30:00\",\"status\":\"scheduled\",\"capacity\":160,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Мурманск #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((20 + i)); HOUR=$((8 + i % 10)); PRICE=$((7500 + (i * 400)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU91$(printf "%02d" $i)\",\"airline\":\"Аэрофлот\",\"origin\":\"Москва\",\"destination\":\"Стамбул\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+3))):30:00\",\"status\":\"scheduled\",\"capacity\":180,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Стамбул #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((22 + i)); HOUR=$((20 + i % 4)); PRICE=$((10000 + (i * 600)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"SU92$(printf "%02d" $i)\",\"airline\":\"Аэрофлот\",\"origin\":\"Москва\",\"destination\":\"Дубай\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+5))):00:00\",\"status\":\"scheduled\",\"capacity\":180,\"price\":$PRICE}" > /dev/null && echo "✓ Москва→Дубай #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((14 + i)); HOUR=$((7 + i % 10)); PRICE=$((2800 + (i * 250)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"DP10$(printf "%02d" $i)\",\"airline\":\"Победа\",\"origin\":\"Санкт-Петербург\",\"destination\":\"Москва\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+1))):30:00\",\"status\":\"scheduled\",\"capacity\":189,\"price\":$PRICE}" > /dev/null && echo "✓ СПб→Москва #$i"
done

for i in 1 2 3 4 5 6 7 8 9 10; do
  DAY=$((16 + i)); HOUR=$((5 + i % 12)); PRICE=$((6500 + (i * 400)))
  curl -s -X POST "http://localhost:8000/api/flights" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"flight_number\":\"S720$(printf "%02d" $i)\",\"airline\":\"S7 Airlines\",\"origin\":\"Новосибирск\",\"destination\":\"Владивосток\",\"scheduled_departure\":\"2026-06-${DAY}T$(printf "%02d" $HOUR):00:00\",\"scheduled_arrival\":\"2026-06-${DAY}T$(printf "%02d" $((HOUR+5))):00:00\",\"status\":\"scheduled\",\"capacity\":160,\"price\":$PRICE}" > /dev/null && echo "✓ Новосибирск→Владивосток #$i"
done

echo ""
echo "✅ 130 рейсов создано!"