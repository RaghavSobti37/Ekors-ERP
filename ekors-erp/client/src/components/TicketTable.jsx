const TicketTable = () => {
    const tickets = [
      {
        company: 'Tesco Market',
        service: 'Solar',
        deadline: '18 Dec 2020',
        quotation: '$75.67',
        status: '78% Welcome'
      },
      // Add other ticket data from your image
    ];
  
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-3 px-4 text-left">Company Name</th>
              <th className="py-3 px-4 text-left">Service</th>
              <th className="py-3 px-4 text-left">Deadline</th>
              <th className="py-3 px-4 text-left">Quotation</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left">Edit</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, index) => (
              <tr key={index} className="border-b">
                <td className="py-3 px-4">{ticket.company}</td>
                <td className="py-3 px-4">{ticket.service}</td>
                <td className="py-3 px-4">{ticket.deadline}</td>
                <td className="py-3 px-4">{ticket.quotation}</td>
                <td className="py-3 px-4">💬 {ticket.status}</td>
                <td className="py-3 px-4">💬</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };