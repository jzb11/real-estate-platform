import type { OfferEmailData } from './types';

/**
 * Generate professional offer email (HTML + plain text)
 * Includes unsubscribe link (required by CAN-SPAM) and SMTP unsubscribe header
 */
export function renderOfferEmail(data: OfferEmailData) {
  const {
    propertyAddress,
    propertyCity,
    propertyState,
    propertyZip,
    estimatedValue,
    repairCosts,
    mao,
    offerPrice,
    equityPercent,
    realtor,
  } = data;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://example.com';
  const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(realtor.email)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #003366; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .property { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #003366; }
    .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    .footer a { color: #003366; }
    table { width: 100%; margin: 10px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Professional Offer Letter</h1>
    </div>
    <div class="content">
      <p>We have a professional offer for your property:</p>

      <div class="property">
        <h3>${propertyAddress}</h3>
        <p>${propertyCity}, ${propertyState} ${propertyZip}</p>
      </div>

      <h4>Offer Summary</h4>
      <table>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>Estimated Value (ARV)</td>
          <td>$${estimatedValue.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Estimated Repair Costs</td>
          <td>$${repairCosts.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Maximum Allowable Offer (70% Rule)</td>
          <td>$${mao.toLocaleString()}</td>
        </tr>
        <tr style="background: #e8f4f8;">
          <td><strong>Our Offer</strong></td>
          <td><strong>$${offerPrice.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td>Your Equity (at our offer)</td>
          <td>${equityPercent.toFixed(1)}%</td>
        </tr>
      </table>

      <h4>Contact Information</h4>
      <p>
        <strong>${realtor.name}</strong><br>
        Phone: <a href="tel:${realtor.phone}">${realtor.phone}</a><br>
        Email: <a href="mailto:${realtor.email}">${realtor.email}</a>
      </p>

      <p>
        We are ready to move quickly and offer a fair price for your property.
        Please contact us to discuss this opportunity.
      </p>
    </div>

    <div class="footer">
      <p>
        <a href="${unsubscribeUrl}">Unsubscribe from future offers</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const plainText = `
Professional Offer Letter

Property: ${propertyAddress}
${propertyCity}, ${propertyState} ${propertyZip}

Offer Summary:
- Estimated Value (ARV): $${estimatedValue.toLocaleString()}
- Estimated Repair Costs: $${repairCosts.toLocaleString()}
- Maximum Allowable Offer (70% Rule): $${mao.toLocaleString()}
- Our Offer: $${offerPrice.toLocaleString()}
- Your Equity (at our offer): ${equityPercent.toFixed(1)}%

Contact Information:
${realtor.name}
Phone: ${realtor.phone}
Email: ${realtor.email}

We are ready to move quickly and offer a fair price for your property.
Please contact us to discuss this opportunity.

Unsubscribe: ${unsubscribeUrl}
  `;

  return {
    html: htmlContent,
    text: plainText,
    unsubscribeUrl,
  };
}
