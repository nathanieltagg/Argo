#ifndef COMPOSERFACTORY_H_2774D6C0
#define COMPOSERFACTORY_H_2774D6C0

#include "Composer.h"
// 
// Should only be one of these objects instantiated. used to create and dispatch Composers to do their jobs.
class ComposerFactory
{
  public:
   ComposerFactory(const Config_t config) : m_config(config){};
   
   void initialize();
   
   Result_t compose(Request_t request);
  
   ~ComposerFactory() {};
   
   static size_t events_served;


   Config_t m_config;
};


#endif /* end of include guard: COMPOSERFACTORY_H_2774D6C0 */
