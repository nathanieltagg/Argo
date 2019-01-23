#ifndef COMPOSERFACTORY_H_2774D6C0
#define COMPOSERFACTORY_H_2774D6C0

#include "Composer.h"

// 
// Should only be one of these objects instantiated. used to create and dispatch Composers to do their jobs.
class ComposerFactory
{
  public:
   ComposerFactory();
  
   void     configure(const Config_t config);
   Output_t compose(Request_t request, Composer::ProgressCallback_t=nullptr);
  
  
   ~ComposerFactory() {};
   
   static size_t events_served;


   Config_t m_config;
   
   int     m_composer_seq;
   long    m_max_age;
   size_t  m_max_composers;
   typedef std::shared_ptr<Composer> ComposerPtr_t;
   typedef std::map<int,ComposerPtr_t> ComposerStore_t;
   ComposerStore_t    m_composers;
   std::map<int,long> m_composer_births;
   
   boost::mutex  m_factory_mutex;
};


#endif /* end of include guard: COMPOSERFACTORY_H_2774D6C0 */
