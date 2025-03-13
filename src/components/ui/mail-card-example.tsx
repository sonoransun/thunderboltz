import { MailCard, MailCardList } from './mail-card'

export function MailCardExample() {
  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Mail Inbox Example</h1>

      <MailCardList>
        <MailCard
          id="mail-1"
          from="john.doe@example.com"
          to="me@example.com"
          date="Today, 10:30 AM"
          content="Hello! I wanted to follow up on our discussion from yesterday. Let me know your thoughts when you get a chance."
          footer={<button className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm">Reply</button>}
        />

        <MailCard
          id="mail-2"
          from="support@company.com"
          to="me@example.com"
          date="Yesterday, 4:15 PM"
          content="Your support ticket #12345 has been resolved. Please let us know if you have any further questions."
          footer={<button className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm">Archive</button>}
        />

        <MailCard
          id="mail-3"
          from="newsletter@tech.com"
          to="me@example.com"
          date="Jan 15, 2023"
          content={
            <div>
              <h3 className="font-medium mb-2">Weekly Tech Digest</h3>
              <p>Here are the top stories from this week:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>New AI developments in natural language processing</li>
                <li>The future of web development with React 19</li>
                <li>How to optimize your application performance</li>
              </ul>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm">Read More</button>
              <button className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm">Unsubscribe</button>
            </div>
          }
        />
      </MailCardList>
    </div>
  )
}
