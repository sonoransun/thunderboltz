import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/settings/provider'
import { ModelsSettings } from '@/types'

const formSchema = z.object({
  openai_api_key: z.string().min(1, { message: 'OpenAI API Key is required.' }),
})

export default function ModelsSettingsPage() {
  const { settings, setSettings } = useSettings()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      openai_api_key: settings.models?.openai_api_key || '',
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setSettings({
      ...settings,
      models: values as ModelsSettings,
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4 w-full max-w-[760px] mx-auto">
        <h2 className="text-xl font-bold">Models</h2>
        <Card>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="openai_api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenAI API Key</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="OpenAI API Key" {...field} />
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
