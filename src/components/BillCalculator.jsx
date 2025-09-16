import { useState, useEffect, useRef } from 'react'
import { Users, Calculator, RotateCcw, Edit3, Check, X, Plus, UserPlus, Share2, Camera } from 'lucide-react'
import html2canvas from 'html2canvas'
import { saveAs } from 'file-saver'

const BillCalculator = ({ extractedData, onReset }) => {
  const [items, setItems] = useState([])
  const [editingItem, setEditingItem] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [testText, setTestText] = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const [manualDiscount, setManualDiscount] = useState(0)
  const [manualTotal, setManualTotal] = useState(0)
  const [showSplitPerPerson, setShowSplitPerPerson] = useState(false)
  const [people, setPeople] = useState([])
  const [serviceFee, setServiceFee] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0)
  
  // Ref untuk screenshot
  const resultsRef = useRef(null)

  useEffect(() => {
    if (extractedData) {
      // Handle new format with item_detail and summary
      if (extractedData.item_detail) {
        const formattedItems = extractedData.item_detail.map(item => ({
          name: item.name,
          quantity: parseInt(item.qty) || 1,
          unitPrice: parseFloat(item.price.replace(/[Rp.,]/g, '')) || 0,
          totalPrice: parseFloat(item.total_price.replace(/[Rp.,]/g, '')) || 0
        }))
        setItems(formattedItems)
      } else {
        // Fallback to old format
        setItems(extractedData.items || [])
      }
      
      // Handle summary data
      if (extractedData.summary) {
        setManualDiscount(Math.abs(extractedData.summary.voucher_diskon) || 0)
        setServiceFee(extractedData.summary.layanan || 0)
        setDeliveryFee(extractedData.summary.pengiriman || 0)
        setManualTotal(extractedData.summary.total || 0)
      } else {
        // Fallback to old format
        setManualDiscount(extractedData.discount || 0)
        setManualTotal(extractedData.total || 0)
      }
    }
  }, [extractedData])

  const handleEditPrice = (index, newPrice) => {
    const updatedItems = [...items]
    updatedItems[index].price = parseFloat(newPrice) || 0
    setItems(updatedItems)
    setEditingItem(null)
    setEditPrice('')
  }

  const parseReceiptText = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const item_detail = [];
    const bills = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Parse menu items dengan berbagai format:
      // "1 2x NasiBabat Rp50.000"
      // "1 1x Ayam rendang Rp18.000"
      // "(2) 1x Nasi ayam rendang Rp25.000"
      // "8 1x Es kopi Rp7.000"
      const menuMatch = trimmedLine.match(/^(?:\d+|\(\d+\))\s+(\d+)x\s+(.+?)\s+Rp([\d.,]+)/i);
      if (menuMatch) {
        const qty = menuMatch[1] + 'x';
        let name = menuMatch[2].trim();
        const totalPrice = 'Rp' + menuMatch[3];
        
        // Clean up name - remove extra characters and normalize
        name = name.replace(/[IK\)\(\|Sa]/g, '').trim();
        
        item_detail.push({
          qty: qty,
          name: name,
          total_price: totalPrice
        });
        continue;
      }

      // Parse bills - semua line yang mengandung informasi billing
      // "Subtotal Pesanan (5 menu) Rp100.000"
      const subtotalMatch = trimmedLine.match(/Subtotal.*?Rp([\d.,]+)/i);
      if (subtotalMatch) {
        bills.push(trimmedLine);
        continue;
      }

      // "Voucher Diskon -Rp40.000"
      const discountMatch = trimmedLine.match(/(?:Voucher\s+)?Diskon\s+-Rp([\d.,]+)/i);
      if (discountMatch) {
        bills.push(trimmedLine);
        continue;
      }

      // "Biaya Pengiriman @ Rp0"
      const ongkirMatch = trimmedLine.match(/Biaya\s+Pengiriman.*?Rp([\d.,]+)/i);
      if (ongkirMatch) {
        // Clean up format untuk bills
        const cleanBiayaPengiriman = trimmedLine.replace(/[@©]/g, '').trim();
        bills.push(cleanBiayaPengiriman);
        continue;
      }

      // "Biaya Layanan © Rp1.000"
      const adminMatch = trimmedLine.match(/Biaya\s+Layanan.*?Rp([\d.,]+)/i);
      if (adminMatch) {
        // Clean up format untuk bills
        const cleanBiayaLayanan = trimmedLine.replace(/[@©]/g, '').trim();
        bills.push(cleanBiayaLayanan);
        continue;
      }

      // Parse total (final amount): "Rp61.000"
      const totalMatch = trimmedLine.match(/^Rp([\d.,]+)$/i);
      if (totalMatch && !trimmedLine.includes('Subtotal') && !trimmedLine.includes('Biaya') && !trimmedLine.includes('Diskon')) {
        bills.push(trimmedLine);
        continue;
      }
    }

    return { item_detail, bills };
  };

  const parseItemName = (name) => {
    let quantity = 1;
    let totalPrice = 0;
    let cleanName = name;

    // Extract quantity from formats like "1 2x" or "2x"
    const qtyMatch = name.match(/(\d+)x/gi);
    if (qtyMatch && qtyMatch.length > 0) {
      // Get the last match (the one right before 'x')
      const lastMatch = qtyMatch[qtyMatch.length - 1];
      quantity = parseInt(lastMatch.replace('x', ''));
      cleanName = name.replace(/^\d+\s+/, '').replace(/\d+x\s*/i, '').trim();
    }

    // Extract total price from "Rp50.000" format
    const priceMatch = name.match(/Rp\s*([\d.,]+)/i);
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/[.,]/g, '');
      totalPrice = parseInt(priceStr) || 0;
      cleanName = cleanName.replace(/Rp\s*[\d.,]+/i, '').trim();
    }

    return { quantity, totalPrice, cleanName };
  };

  const editItem = (index, field, value) => {
    const newItems = [...items]
    
    if (field === 'name') {
      const parsed = parseItemName(value);
      const hasQuantity = value.match(/(\d+)x/i);
      const hasPrice = value.match(/Rp\s*[\d.,]+/i);
      
      const newQuantity = hasQuantity ? parsed.quantity : newItems[index].quantity;
      const newTotalPrice = hasPrice ? parsed.totalPrice : newItems[index].totalPrice;
      const newUnitPrice = hasPrice && newQuantity > 0 
        ? newTotalPrice / newQuantity 
        : newItems[index].unitPrice;
      
      newItems[index] = {
        ...newItems[index],
        name: parsed.cleanName,
        quantity: newQuantity,
        totalPrice: newTotalPrice,
        unitPrice: newUnitPrice
      };
    } else if (field === 'quantity' || field === 'unitPrice') {
      newItems[index] = { 
        ...newItems[index], 
        [field]: parseFloat(value) || 0,
        totalPrice: field === 'quantity' ? 
          (parseFloat(value) || 0) * (newItems[index].unitPrice || 0) :
          (newItems[index].quantity || 1) * (parseFloat(value) || 0)
      }
    } else if (field === 'totalPrice' && newItems[index].quantity > 0) {
      newItems[index] = {
        ...newItems[index],
        totalPrice: parseFloat(value) || 0,
        unitPrice: (parseFloat(value) || 0) / newItems[index].quantity
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setItems(newItems)
  }

  const addNewItem = () => {
    const newItem = {
      id: Date.now(),
      name: 'Item Baru',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    };
    setItems([...items, newItem]);
  }

  const testParsing = () => {
    if (testText.trim()) {
      const result = parseReceiptText(testText);
      setParsedResult(result);
      console.log('Parsed Result:', JSON.stringify(result, null, 2));
    }
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const generateRandomName = () => {
    const names = ['Panda', 'Tiger', 'Lion', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Rabbit', 'Deer', 'Owl']
    return names[Math.floor(Math.random() * names.length)]
  }

  const addPerson = () => {
    const newPerson = {
      id: Date.now(),
      name: `Orang ${people.length + 1}`,
      selectedItems: []
    }
    setPeople([...people, newPerson])
  }

  const removePerson = (personId) => {
    setPeople(people.filter(person => person.id !== personId))
  }

  const updatePersonName = (personId, newName) => {
    setPeople(people.map(person => 
      person.id === personId ? { ...person, customName: newName } : person
    ))
  }

  // Fungsi untuk screenshot dan share
  const takeScreenshot = async () => {
    if (!resultsRef.current) return
    
    try {
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true
      })
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `split-bill-${new Date().toISOString().slice(0, 10)}.png`)
        }
      })
    } catch (error) {
      console.error('Error taking screenshot:', error)
      alert('Gagal mengambil screenshot')
    }
  }

  const shareToWhatsApp = async () => {
    if (!resultsRef.current) return
    
    try {
      // Generate text summary
      let message = "🧾 *SPLIT BILL CALCULATOR*\n\n"
      
      // Add items summary based on mode
      if (showSplitPerPerson && people.length > 0) {
        message += "📋 *PEMBAGIAN PER ORANG:*\n"
        people.forEach(person => {
          if (person.selectedItems && person.selectedItems.length > 0) {
            const personTotal = calculatePersonTotal(person)
            message += `👤 *${person.customName || person.name}:*\n`
            
            person.selectedItems.forEach(selection => {
              const item = items[selection.itemIndex]
              if (item) {
                const itemSubtotal = (item.unitPrice || 0) * selection.quantity
                message += `   • ${selection.quantity}x ${item.name} @ ${formatCurrency(item.unitPrice || 0)} = ${formatCurrency(itemSubtotal)}\n`
              }
            })
            
            message += `   💰 Total: ${formatCurrency(personTotal)}\n\n`
          }
        })
        
        // Add total summary for split per person
        const totalAllPeople = people.reduce((sum, person) => sum + calculatePersonTotal(person), 0)
        message += `🎯 *TOTAL SEMUA ORANG: ${formatCurrency(totalAllPeople)}*\n\n`
        
      } else {
        // Show detailed calculation breakdown
        message += "📋 *DETAIL PERHITUNGAN:*\n"
        items.forEach((item, index) => {
          if ((item.quantity || 0) > 0) {
            const itemPrice = item.totalPrice || 0
            const itemDiscount = (manualDiscount * itemPrice) / totals.itemsTotal || 0
            const itemTotal = itemPrice - itemDiscount
            
            message += `${index + 1}. *${item.quantity || 1}x ${item.name}*\n`
            message += `   • Harga Satuan: ${formatCurrency(item.unitPrice || 0)}\n`
            message += `   • Subtotal: ${formatCurrency(itemPrice)}\n`
            if (itemDiscount > 0) {
              message += `   • Potongan: -${formatCurrency(itemDiscount)}\n`
            }
            message += `   • Total: ${formatCurrency(itemTotal)}\n`
            message += `   • Per qty: ${formatCurrency(itemTotal / (item.quantity || 1))}\n\n`
          }
        })
        
        // Add calculation summary
        message += "💳 *RINGKASAN BIAYA:*\n"
        message += `Subtotal Item: ${formatCurrency(totals.itemsTotal)}\n`
        if (totals.discount > 0) {
          message += `Total Diskon: -${formatCurrency(totals.discount)}\n`
        }
        message += `Subtotal setelah Diskon: ${formatCurrency(totals.subtotal)}\n`
        if (totals.serviceFee > 0) {
          message += `Biaya Layanan: ${formatCurrency(totals.serviceFee)}\n`
        }
        if (totals.deliveryFee > 0) {
          message += `Biaya Pengiriman: ${formatCurrency(totals.deliveryFee)}\n`
        }
        message += `\n🎯 *TOTAL KESELURUHAN: ${formatCurrency(totals.finalTotal)}*`
      }
      
      // Open WhatsApp with message
      const encodedMessage = encodeURIComponent(message)
      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
      window.open(whatsappUrl, '_blank')
      
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error)
      alert('Gagal membagikan ke WhatsApp')
    }
  }

  const updatePersonItemQuantity = (personId, itemIndex, newQuantity) => {
    const remainingQty = getRemainingQuantity(itemIndex)
    const person = people.find(p => p.id === personId)
    const currentSelection = person?.selectedItems.find(s => s.itemIndex === itemIndex)
    const currentQty = currentSelection ? currentSelection.quantity : 0
    
    // Validasi: quantity baru tidak boleh melebihi sisa yang tersedia + quantity saat ini
    const maxAllowed = remainingQty + currentQty
    const validatedQuantity = Math.min(Math.max(0, newQuantity), maxAllowed)
    
    setPeople(prevPeople => 
      prevPeople.map(person => {
        if (person.id === personId) {
          const existingSelectionIndex = person.selectedItems.findIndex(s => s.itemIndex === itemIndex)
          
          if (validatedQuantity === 0) {
            // Hapus item jika quantity 0
            return {
              ...person,
              selectedItems: person.selectedItems.filter(s => s.itemIndex !== itemIndex)
            }
          } else {
            if (existingSelectionIndex >= 0) {
              // Update quantity yang sudah ada
              const updatedSelections = [...person.selectedItems]
              updatedSelections[existingSelectionIndex] = { itemIndex, quantity: validatedQuantity }
              return { ...person, selectedItems: updatedSelections }
            } else {
              // Tambah item baru
              return {
                ...person,
                selectedItems: [...person.selectedItems, { itemIndex, quantity: validatedQuantity }]
              }
            }
          }
        }
        return person
      })
    )
  }

  const toggleItemForPerson = (personId, itemIndex) => {
    setPeople(people.map(person => {
      if (person.id === personId) {
        const selectedItems = person.selectedItems.includes(itemIndex)
          ? person.selectedItems.filter(i => i !== itemIndex)
          : [...person.selectedItems, itemIndex]
        return { ...person, selectedItems }
      }
      return person
    }))
  }

  const calculateTotals = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const subtotal = itemsTotal - manualDiscount
    const finalTotal = manualTotal > 0 ? manualTotal : (subtotal + serviceFee + deliveryFee)
    
    return {
      itemsTotal,
      discount: manualDiscount,
      subtotal,
      serviceFee,
      deliveryFee,
      finalTotal
    }
  }

  // Fungsi untuk menghitung sisa quantity yang tersedia per item
  const getRemainingQuantity = (itemIndex) => {
    const item = items[itemIndex]
    if (!item) return 0
    
    const maxQty = item.quantity || 1
    let totalSelected = 0
    
    // Hitung total quantity yang sudah dipilih semua orang untuk item ini
    people.forEach(person => {
      const selectedItem = person.selectedItems.find(s => s.itemIndex === itemIndex)
      if (selectedItem) {
        totalSelected += selectedItem.quantity
      }
    })
    
    return Math.max(0, maxQty - totalSelected)
  }

  const calculatePersonTotal = (person) => {
    let personItemsTotal = 0
    let totalSelectedItemsValue = 0
    
    // Calculate person's items total
    person.selectedItems.forEach(selection => {
      const item = items[selection.itemIndex]
      if (item) {
        const itemUnitPrice = item.unitPrice || 0
        const selectedQty = selection.quantity || 0
        personItemsTotal += itemUnitPrice * selectedQty
      }
    })
    
    // Calculate total value of all selected items by all people
    people.forEach(p => {
      p.selectedItems.forEach(selection => {
        const item = items[selection.itemIndex]
        if (item) {
          const itemUnitPrice = item.unitPrice || 0
          const selectedQty = selection.quantity || 0
          totalSelectedItemsValue += itemUnitPrice * selectedQty
        }
      })
    })
    
    // Calculate proportional discount and service fee based on person's items value
    const personDiscount = totalSelectedItemsValue > 0 ? 
      (manualDiscount * personItemsTotal / totalSelectedItemsValue) : 0
    
    const personServiceFee = totalSelectedItemsValue > 0 ? 
      (serviceFee * personItemsTotal / totalSelectedItemsValue) : 0
    
    // Delivery fee split equally among people who have selected items
    const peopleWithItems = people.filter(p => p.selectedItems.length > 0)
    const personDeliveryFee = peopleWithItems.length > 0 ? (deliveryFee / peopleWithItems.length) : 0
    
    return personItemsTotal - personDiscount + personServiceFee + personDeliveryFee
  }

  const totals = calculateTotals()

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="bill-calculator">
      <div className="calculator-header">
        <div className="header-content">
          <div className="header-text">
            <h2>Hasil Scan Struk</h2>
            <p className="platform-info">
              Platform: <strong>{extractedData.platform}</strong>
            </p>
          </div>
          <div className="header-actions">
            <button onClick={takeScreenshot} className="action-btn screenshot-btn" title="Screenshot">
              <Camera size={20} />
              Screenshot
            </button>
            <button onClick={shareToWhatsApp} className="action-btn whatsapp-btn" title="Share ke WhatsApp">
              <Share2 size={20} />
              Share WA
            </button>
          </div>
        </div>
      </div>

      <div className="calculator-content">
        {/* Parsing Test Section */}
        <div className="parsing-test-section">
          <h3>Test Receipt Parsing</h3>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Paste receipt text here...\n\nExample:\n1 2x NasiBabat Rp50.000\n1 1x Ayam rendang Rp18.000\n(2) 1x Nasi ayam rendang Rp25.000\n8 1x Es kopi Rp7.000\nSubtotal Pesanan (5 menu) Rp100.000\nVoucher Diskon -Rp40.000\nBiaya Pengiriman @ Rp0\nBiaya Layanan © Rp1.000\nRp61.000"
            rows={8}
            className="test-textarea"
          />
          <button onClick={testParsing} className="test-btn">
            Parse Text
          </button>
          
          {parsedResult && (
            <div className="parsed-result">
              <h4>Parsed Result:</h4>
              <pre className="json-output">
                {JSON.stringify(parsedResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Items Section */}
        <div className="items-section">
          <div className="items-header">
            <h3>Daftar Item</h3>
            <button onClick={addNewItem} className="add-item-btn">
              <Plus size={20} />
              Tambah Item
            </button>
          </div>
          
          <div className="items-grid">
            {items.map((item, index) => (
              <div key={index} className="item-card">
                <div className="item-header">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => editItem(index, 'name', e.target.value)}
                    className="item-name-input"
                    placeholder="Nama item"
                  />
                  <button 
                    onClick={() => removeItem(index)}
                    className="remove-item-btn"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="item-details">
                  <div className="item-field">
                    <label>Quantity:</label>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => editItem(index, 'quantity', e.target.value)}
                      className="quantity-input"
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  
                  <div className="item-field">
                    <label>Harga Satuan:</label>
                    <input
                      type="number"
                      value={item.unitPrice || ''}
                      onChange={(e) => editItem(index, 'unitPrice', e.target.value)}
                      className="price-input"
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="item-field">
                    <label>Total Harga:</label>
                    <input
                      type="number"
                      value={item.totalPrice || ''}
                      onChange={(e) => editItem(index, 'totalPrice', e.target.value)}
                      className="price-input"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Additional Fees */}
        <div className="fees-section">
          <h3>Biaya Tambahan</h3>
          <div className="fees-grid">
            <div className="fee-item">
              <label>Biaya Layanan:</label>
              <input
                type="number"
                value={serviceFee || ''}
                onChange={(e) => setServiceFee(parseFloat(e.target.value) || 0)}
                className="fee-input"
                placeholder="0"
              />
            </div>
            
            <div className="fee-item">
              <label>Biaya Pengiriman:</label>
              <input
                type="number"
                value={deliveryFee || ''}
                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                className="fee-input"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Manual Adjustments */}
        <div className="adjustments-section">
          <h3>Penyesuaian Manual</h3>
          <div className="adjustment-row">
            <label>Diskon:</label>
            <input
              type="number"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(parseFloat(e.target.value) || 0)}
              className="adjustment-input"
            />
          </div>
          <div className="adjustment-row">
            <label>Total Manual (opsional):</label>
            <input
              type="number"
              value={manualTotal}
              onChange={(e) => setManualTotal(parseFloat(e.target.value) || 0)}
              className="adjustment-input"
              placeholder="Kosongkan untuk hitung otomatis"
            />
          </div>
        </div>

        {/* Split Bill Per Orang */}
        <div className="split-section">
          <div className="split-header">
            <h3>Pembagian Bill</h3>
            <button 
              onClick={() => setShowSplitPerPerson(!showSplitPerPerson)}
              className={`split-toggle-btn ${showSplitPerPerson ? 'active' : ''}`}
            >
              <UserPlus size={20} />
              Split Bill Per Orang
            </button>
          </div>
          
          {showSplitPerPerson && (
            <div className="split-per-person">
              <div className="people-list">
                {people.map((person) => (
                  <div key={person.id} className="person-card">
                    <div className="person-header">
                      <input
                        type="text"
                        value={person.customName || person.name}
                        onChange={(e) => updatePersonName(person.id, e.target.value)}
                        className="person-name-input"
                        placeholder={person.name}
                      />
                      <button 
                        onClick={() => removePerson(person.id)}
                        className="remove-person-btn"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="person-items">
                      <h4>Pilih Menu:</h4>
                      <div className="items-checkboxes">
                        {items.map((item, index) => {
                          const selectedItem = person.selectedItems.find(s => s.itemIndex === index)
                          const selectedQty = selectedItem ? selectedItem.quantity : 0
                          const maxQty = item.quantity || 1
                          const remainingQty = getRemainingQuantity(index) + selectedQty
                          
                          return (
                            <div key={index} className="item-selection">
                              <div className="item-info">
                                <span className="item-name">
                                  {item.name} - {formatCurrency(item.unitPrice || 0)}
                                  <small> (Tersedia: {remainingQty})</small>
                                </span>
                              </div>
                              <div className="quantity-selector">
                                <label>Qty:</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={remainingQty}
                                  value={selectedQty}
                                  onChange={(e) => updatePersonItemQuantity(person.id, index, parseInt(e.target.value) || 0)}
                                  className="qty-input"
                                  disabled={remainingQty === 0}
                                  style={{
                                    backgroundColor: remainingQty === 0 ? '#f5f5f5' : 'white',
                                    color: remainingQty === 0 ? '#999' : 'black'
                                  }}
                                />
                                <span className="subtotal">
                                  = {formatCurrency((item.unitPrice || 0) * selectedQty)}
                                </span>
                                {remainingQty === 0 && selectedQty === 0 && (
                                  <small style={{ color: '#ff6b6b', marginLeft: '8px' }}>
                                    Habis
                                  </small>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    <div className="person-total">
                      <div className="total-breakdown">
                        <div className="breakdown-item">
                          <span>Subtotal Item:</span>
                          <span>{formatCurrency(
                            person.selectedItems.reduce((sum, selection) => {
                              const item = items[selection.itemIndex]
                              return sum + ((item?.unitPrice || 0) * (selection.quantity || 0))
                            }, 0)
                          )}</span>
                        </div>
                        <div className="breakdown-item">
                           <span>Diskon:</span>
                           <span>-{formatCurrency(
                             (() => {
                               const personItemsTotal = person.selectedItems.reduce((sum, selection) => {
                                 const item = items[selection.itemIndex]
                                 return sum + ((item?.unitPrice || 0) * (selection.quantity || 0))
                               }, 0)
                               let totalSelectedItemsValue = 0
                               people.forEach(p => {
                                 p.selectedItems.forEach(selection => {
                                   const item = items[selection.itemIndex]
                                   if (item) {
                                     totalSelectedItemsValue += (item.unitPrice || 0) * (selection.quantity || 0)
                                   }
                                 })
                               })
                               return totalSelectedItemsValue > 0 ? (manualDiscount * personItemsTotal / totalSelectedItemsValue) : 0
                             })()
                           )}</span>
                         </div>
                         <div className="breakdown-item">
                           <span>Biaya Layanan:</span>
                           <span>{formatCurrency(
                             (() => {
                               const personItemsTotal = person.selectedItems.reduce((sum, selection) => {
                                 const item = items[selection.itemIndex]
                                 return sum + ((item?.unitPrice || 0) * (selection.quantity || 0))
                               }, 0)
                               let totalSelectedItemsValue = 0
                               people.forEach(p => {
                                 p.selectedItems.forEach(selection => {
                                   const item = items[selection.itemIndex]
                                   if (item) {
                                     totalSelectedItemsValue += (item.unitPrice || 0) * (selection.quantity || 0)
                                   }
                                 })
                               })
                               return totalSelectedItemsValue > 0 ? (serviceFee * personItemsTotal / totalSelectedItemsValue) : 0
                             })()
                           )}</span>
                         </div>
                        <div className="breakdown-item">
                           <span>Biaya Pengiriman:</span>
                           <span>{formatCurrency(
                             (() => {
                               const peopleWithItems = people.filter(p => p.selectedItems.length > 0)
                               return peopleWithItems.length > 0 ? (deliveryFee / peopleWithItems.length) : 0
                             })()
                           )}</span>
                         </div>
                      </div>
                      <div className="total-final">
                        <strong>Total: {formatCurrency(calculatePersonTotal(person))}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button onClick={addPerson} className="add-person-btn">
                <Plus size={20} />
                Tambah Orang
              </button>
            </div>
          )}
        </div>

        {/* Calculation Results */}
        <div className="results-section" ref={resultsRef}>
          <h3>
            <Calculator size={20} />
            Hasil Perhitungan
          </h3>
          
          {showSplitPerPerson && people.length > 0 ? (
            <div className="per-person-results">
              <h4>Pembagian Per Orang:</h4>
              {people.map((person) => {
                const personTotal = calculatePersonTotal(person)
                
                return (
                  <div key={person.id} className="person-result">
                    <div className="person-result-header">
                      <strong>{person.customName || person.name}</strong>
                      <span className="person-result-total">{formatCurrency(personTotal)}</span>
                    </div>
                    <div className="person-result-items">
                       {person.selectedItems.map((selection, index) => {
                         const item = items[selection.itemIndex]
                         const selectedQty = selection.quantity || 0
                         const itemUnitPrice = item?.unitPrice || 0
                         const itemSubtotal = itemUnitPrice * selectedQty
                         
                         return (
                           <div key={index} className="person-result-item">
                             <span>{selectedQty}x {item?.name} @ {formatCurrency(itemUnitPrice)}</span>
                             <span>{formatCurrency(itemSubtotal)}</span>
                           </div>
                         )
                       })}
                     </div>
                  </div>
                )
              })}
              
              <div className="total-summary">
                <div className="summary-row total">
                  <span>Total Semua Orang:</span>
                  <span>{formatCurrency(people.reduce((sum, person) => sum + calculatePersonTotal(person), 0))}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="calculation-breakdown">
              {/* Detail per item */}
              {items.map((item, index) => {
                const itemPrice = item.totalPrice || 0
                const itemDiscount = (manualDiscount * itemPrice) / totals.itemsTotal || 0
                const itemTotal = itemPrice - itemDiscount
                
                return (
                  <div key={index} className="item-calculation">
                    <div className="item-calc-header">
                      <span className="item-number">{index + 1}.</span>
                      <span className="item-calc-name">{item.quantity || 1}x {item.name}</span>
                    </div>
                    <div className="item-calc-details">
                      <div className="calc-detail-row">
                        <span>- Harga Satuan:</span>
                        <span>{formatCurrency(item.unitPrice || 0)}</span>
                      </div>
                      <div className="calc-detail-row">
                        <span>- Quantity:</span>
                        <span>{item.quantity || 1}</span>
                      </div>
                      <div className="calc-detail-row">
                        <span>- Subtotal:</span>
                        <span>{formatCurrency(itemPrice)}</span>
                      </div>
                      {itemDiscount > 0 && (
                        <div className="calc-detail-row discount">
                          <span>- Potongan:</span>
                          <span>{formatCurrency(itemDiscount)}</span>
                        </div>
                      )}
                      <div className="calc-detail-row total">
                        <span>- Total bayar:</span>
                        <span className="item-total">{formatCurrency(itemTotal)}</span>
                      </div>
                      <div className="calc-detail-row">
                        <span>- Total bayar per qty:</span>
                        <span>{formatCurrency(itemTotal / (item.quantity || 1))}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Summary */}
              <div className="calculation-summary">
                <div className="calc-row">
                  <span>Subtotal Item:</span>
                  <span>{formatCurrency(totals.itemsTotal)}</span>
                </div>
                
                {totals.discount > 0 && (
                  <div className="calc-row discount">
                    <span>Total Diskon:</span>
                    <span>-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                
                <div className="calc-row">
                  <span>Subtotal setelah Diskon:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                
                {totals.serviceFee > 0 && (
                  <div className="calc-row">
                    <span>Biaya Layanan:</span>
                    <span>{formatCurrency(totals.serviceFee)}</span>
                  </div>
                )}
                
                {totals.deliveryFee > 0 && (
                  <div className="calc-row">
                    <span>Biaya Pengiriman:</span>
                    <span>{formatCurrency(totals.deliveryFee)}</span>
                  </div>
                )}
                
                <div className="calc-row total">
                  <span>Total Keseluruhan:</span>
                  <span>{formatCurrency(totals.finalTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={onReset} className="reset-button">
            <RotateCcw size={20} />
            Scan Struk Baru
          </button>
        </div>

        {/* Raw Text Debug (for development) */}
        {extractedData.rawText && (
          <details className="debug-section">
            <summary>Text yang Terdeteksi (Debug)</summary>
            <pre className="raw-text">{extractedData.rawText}</pre>
          </details>
        )}
      </div>
    </div>
  )
}

export default BillCalculator