import { zodResolver } from '@hookform/resolvers/zod'
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettings } from '@/settings/provider'
import { AccountsSettings } from '@/types'
import { Plus } from 'lucide-react'

const formSchema = z.object({
  hostname: z.string().min(1, { message: 'Hostname is required.' }),
  port: z.coerce.number().int().min(1, { message: 'Port is required.' }),
  username: z.string().min(1, { message: 'Username is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
})

export default function AccountsSettingsPage() {
  const { settings, setSettings } = useSettings()

  // Add state for the selected account
  const [selectedAccount, setSelectedAccount] = React.useState('john-doe')

  // Mock data for multiple accounts
  const accounts = [
    { id: 'thoughtful', name: 'Thoughtful', email: 'chris@thoughtful.llc' },
    { id: 'personal', name: 'Chris Gmail', email: 'chris.personal@gmail.com' },
  ]

  // Find the currently selected account
  const currentAccount = accounts.find((account) => account.id === selectedAccount) || accounts[0]

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hostname: settings.account?.hostname || '',
      port: settings.account?.port || 3000,
      username: settings.account?.username || '',
      password: settings.account?.password || '',
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setSettings({
      ...settings,
      account: values as AccountsSettings,
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4 w-full max-w-[760px] mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Accounts</h2>
          <Button variant="outline" size="icon">
            <Plus />
          </Button>
        </div>

        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-full p-6 py-8" variant="outline">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center bg-primary text-primary-foreground size-8 rounded-md font-medium">{currentAccount.name[0]}</div>
              <div className="flex flex-col">
                <SelectValue placeholder="Select an account" />
                <div className="text-sm text-muted-foreground">{currentAccount.email}</div>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <p className="text-left">{account.name}</p>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <h2 className="text-xl font-bold">IMAP</h2>
        <Card>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="hostname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hostname</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit">Save</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
